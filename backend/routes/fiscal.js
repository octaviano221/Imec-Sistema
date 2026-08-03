const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

const writeRoles = ['admin', 'rh', 'engenharia'];

function clean(value) {
  const text = value == null ? '' : String(value).trim();
  return text || null;
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function num(value) {
  const n = Number(String(value == null ? '' : value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function stripNs(xml) {
  return String(xml || '').replace(/(<\/?)[A-Za-z0-9_.-]+:/g, '$1');
}

function firstTag(xml, name) {
  const match = String(xml || '').match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return match ? decodeXml(match[1]) : null;
}

function firstBlock(xml, name) {
  const match = String(xml || '').match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return match ? match[1] : '';
}

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) {
    const p = text.slice(0, 10).split('/');
    return `${p[2]}-${p[1]}-${p[0]}`;
  }
  return null;
}

function fileUrl(file) {
  if (!file) return null;
  return '/uploads/' + path.basename(file.filename || file.path);
}

function parseNfeXml(rawXml) {
  const xml = stripNs(rawXml);
  const idMatch = xml.match(/<infNFe[^>]+Id=["']NFe(\d{44})["']/i);
  const emit = firstBlock(xml, 'emit');
  const dest = firstBlock(xml, 'dest');
  const total = firstBlock(firstBlock(xml, 'total'), 'ICMSTot') || firstBlock(xml, 'ICMSTot');

  const detRegex = /<det[^>]*nItem=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/det>/gi;
  const items = [];
  let match;
  while ((match = detRegex.exec(xml))) {
    const prod = firstBlock(match[2], 'prod');
    const imposto = firstBlock(match[2], 'imposto');
    items.push({
      item_number: Number(match[1]) || items.length + 1,
      product_code: firstTag(prod, 'cProd'),
      description: firstTag(prod, 'xProd'),
      ncm: firstTag(prod, 'NCM'),
      cfop: firstTag(prod, 'CFOP'),
      unit: firstTag(prod, 'uCom'),
      quantity: num(firstTag(prod, 'qCom')),
      unit_value: num(firstTag(prod, 'vUnCom')),
      total_value: num(firstTag(prod, 'vProd')),
      icms_value: num(firstTag(imposto, 'vICMS'))
    });
  }

  const cfops = Array.from(new Set(items.map((item) => item.cfop).filter(Boolean)));
  const accessKey = firstTag(firstBlock(xml, 'infProt'), 'chNFe') || (idMatch ? idMatch[1] : null);

  return {
    access_key: accessKey,
    model: firstTag(xml, 'mod') || '55',
    series: firstTag(xml, 'serie'),
    number: firstTag(xml, 'nNF'),
    issue_date: normalizeDate(firstTag(xml, 'dhEmi') || firstTag(xml, 'dEmi')),
    entry_date: normalizeDate(firstTag(xml, 'dhSaiEnt') || firstTag(xml, 'dSaiEnt')),
    operation_type: firstTag(xml, 'natOp'),
    supplier_name: firstTag(emit, 'xNome'),
    supplier_cnpj: digits(firstTag(emit, 'CNPJ') || firstTag(emit, 'CPF')),
    supplier_ie: firstTag(emit, 'IE'),
    client_name: firstTag(dest, 'xNome'),
    client_cnpj: digits(firstTag(dest, 'CNPJ') || firstTag(dest, 'CPF')),
    total_products: num(firstTag(total, 'vProd')),
    total_invoice: num(firstTag(total, 'vNF')),
    freight_value: num(firstTag(total, 'vFrete')),
    discount_value: num(firstTag(total, 'vDesc')),
    icms_base: num(firstTag(total, 'vBC')),
    icms_value: num(firstTag(total, 'vICMS')),
    ipi_value: num(firstTag(total, 'vIPI')),
    pis_value: num(firstTag(total, 'vPIS')),
    cofins_value: num(firstTag(total, 'vCOFINS')),
    cfop: cfops.join(', '),
    items
  };
}

async function audit(userId, action, entityType, entityId, description) {
  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, description]
    );
  } catch (err) {
    console.warn('Auditoria fiscal ignorada:', err && err.message ? err.message : err);
  }
}

async function findOrCreateSupplier(conn, data) {
  const name = clean(data.supplier_name);
  const cnpj = clean(data.supplier_cnpj);
  if (!name && !cnpj) return null;

  if (cnpj) {
    const [rows] = await conn.query('SELECT id FROM stock_suppliers WHERE REPLACE(REPLACE(REPLACE(cnpj, ".", ""), "/", ""), "-", "") = ? LIMIT 1', [digits(cnpj)]);
    if (rows.length) return rows[0].id;
  }
  if (name) {
    const [rows] = await conn.query('SELECT id FROM stock_suppliers WHERE name = ? LIMIT 1', [name]);
    if (rows.length) return rows[0].id;
  }

  const [result] = await conn.query(
    'INSERT INTO stock_suppliers (name, cnpj, status, notes) VALUES (?, ?, ?, ?)',
    [name || cnpj, cnpj, 'ativo', 'Cadastrado automaticamente pelo XML da NF-e']
  );
  return result.insertId;
}

async function listInvoices() {
  const [rows] = await db.query(`
    SELECT fi.*, ss.name AS linked_supplier_name, po.order_number AS purchase_order_number
    FROM fiscal_invoices fi
    LEFT JOIN stock_suppliers ss ON ss.id = fi.supplier_id
    LEFT JOIN purchase_orders po ON po.id = fi.purchase_order_id
    ORDER BY COALESCE(fi.issue_date, fi.created_at) DESC, fi.id DESC
  `);
  return rows;
}

router.get('/summary', authenticate, async (req, res) => {
  try {
    const invoices = await listInvoices();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthInvoices = invoices.filter((invoice) => {
      if (!invoice.issue_date) return false;
      const d = new Date(invoice.issue_date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const pending = invoices.filter((invoice) => invoice.status === 'conferencia' || invoice.status === 'pendente');
    const supplierNames = new Set(invoices.map((invoice) => invoice.supplier_cnpj || invoice.supplier_name).filter(Boolean));
    res.json({
      invoices,
      metrics: {
        invoices: invoices.length,
        month_total: monthInvoices.reduce((sum, invoice) => sum + num(invoice.total_invoice), 0),
        icms_value: invoices.reduce((sum, invoice) => sum + num(invoice.icms_value), 0),
        pending: pending.length,
        suppliers: supplierNames.size
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar modulo fiscal' });
  }
});

router.get('/invoices', authenticate, async (req, res) => {
  try {
    res.json(await listInvoices());
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar notas fiscais' });
  }
});

router.post('/invoices', authenticate, authorize(...writeRoles), async (req, res) => {
  const data = req.body || {};
  try {
    const supplierId = data.supplier_id || null;
    const [result] = await db.query(
      `INSERT INTO fiscal_invoices
      (access_key, model, series, number, issue_date, entry_date, operation_type, supplier_id, supplier_name, supplier_cnpj,
       supplier_ie, client_name, client_cnpj, purchase_order_id, total_products, total_invoice, freight_value,
       discount_value, icms_base, icms_value, ipi_value, pis_value, cofins_value, cfop, status, xml_url, danfe_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clean(data.access_key), clean(data.model) || '55', clean(data.series), clean(data.number),
        normalizeDate(data.issue_date), normalizeDate(data.entry_date), clean(data.operation_type),
        supplierId, clean(data.supplier_name), clean(data.supplier_cnpj), clean(data.supplier_ie),
        clean(data.client_name), clean(data.client_cnpj), data.purchase_order_id || null,
        num(data.total_products), num(data.total_invoice), num(data.freight_value), num(data.discount_value),
        num(data.icms_base), num(data.icms_value), num(data.ipi_value), num(data.pis_value), num(data.cofins_value),
        clean(data.cfop), clean(data.status) || 'conferencia', clean(data.xml_url), clean(data.danfe_url), clean(data.notes)
      ]
    );
    await audit(req.user.id, 'create', 'fiscal_invoice', result.insertId, `Nota fiscal ${data.number || result.insertId} cadastrada`);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar nota fiscal' });
  }
});

router.put('/invoices/:id', authenticate, authorize(...writeRoles), async (req, res) => {
  const data = req.body || {};
  try {
    await db.query(
      `UPDATE fiscal_invoices SET
       access_key=?, model=?, series=?, number=?, issue_date=?, entry_date=?, operation_type=?, supplier_id=?,
       supplier_name=?, supplier_cnpj=?, supplier_ie=?, client_name=?, client_cnpj=?, purchase_order_id=?,
       total_products=?, total_invoice=?, freight_value=?, discount_value=?, icms_base=?, icms_value=?,
       ipi_value=?, pis_value=?, cofins_value=?, cfop=?, status=?, xml_url=?, danfe_url=?, notes=?
       WHERE id=?`,
      [
        clean(data.access_key), clean(data.model) || '55', clean(data.series), clean(data.number),
        normalizeDate(data.issue_date), normalizeDate(data.entry_date), clean(data.operation_type), data.supplier_id || null,
        clean(data.supplier_name), clean(data.supplier_cnpj), clean(data.supplier_ie), clean(data.client_name), clean(data.client_cnpj),
        data.purchase_order_id || null, num(data.total_products), num(data.total_invoice), num(data.freight_value),
        num(data.discount_value), num(data.icms_base), num(data.icms_value), num(data.ipi_value), num(data.pis_value),
        num(data.cofins_value), clean(data.cfop), clean(data.status) || 'conferencia', clean(data.xml_url), clean(data.danfe_url),
        clean(data.notes), req.params.id
      ]
    );
    await audit(req.user.id, 'update', 'fiscal_invoice', req.params.id, `Nota fiscal ${req.params.id} atualizada`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar nota fiscal' });
  }
});

router.delete('/invoices/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM fiscal_invoices WHERE id=?', [req.params.id]);
    await audit(req.user.id, 'delete', 'fiscal_invoice', req.params.id, `Nota fiscal ${req.params.id} excluida`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir nota fiscal' });
  }
});

router.post('/xml/import', authenticate, authorize(...writeRoles), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie o arquivo XML da NF-e' });
  const conn = await db.getConnection();
  try {
    const xml = fs.readFileSync(req.file.path, 'utf8');
    const data = parseNfeXml(xml);
    if (!data.number && !data.access_key) {
      return res.status(400).json({ error: 'Nao foi possivel identificar uma NF-e valida no XML' });
    }
    data.xml_url = fileUrl(req.file);
    await conn.beginTransaction();
    data.supplier_id = await findOrCreateSupplier(conn, data);

    let invoiceId;
    if (data.access_key) {
      const [existing] = await conn.query('SELECT id FROM fiscal_invoices WHERE access_key=? LIMIT 1', [data.access_key]);
      invoiceId = existing[0] && existing[0].id;
    }

    if (invoiceId) {
      await conn.query(
        `UPDATE fiscal_invoices SET model=?, series=?, number=?, issue_date=?, entry_date=?, operation_type=?,
         supplier_id=?, supplier_name=?, supplier_cnpj=?, supplier_ie=?, client_name=?, client_cnpj=?,
         total_products=?, total_invoice=?, freight_value=?, discount_value=?, icms_base=?, icms_value=?,
         ipi_value=?, pis_value=?, cofins_value=?, cfop=?, status=?, xml_url=?
         WHERE id=?`,
        [
          data.model, data.series, data.number, data.issue_date, data.entry_date, data.operation_type,
          data.supplier_id, data.supplier_name, data.supplier_cnpj, data.supplier_ie, data.client_name, data.client_cnpj,
          data.total_products, data.total_invoice, data.freight_value, data.discount_value, data.icms_base, data.icms_value,
          data.ipi_value, data.pis_value, data.cofins_value, data.cfop, 'conferencia', data.xml_url, invoiceId
        ]
      );
      await conn.query('DELETE FROM fiscal_invoice_items WHERE invoice_id=?', [invoiceId]);
    } else {
      const [result] = await conn.query(
        `INSERT INTO fiscal_invoices
        (access_key, model, series, number, issue_date, entry_date, operation_type, supplier_id, supplier_name, supplier_cnpj,
         supplier_ie, client_name, client_cnpj, total_products, total_invoice, freight_value, discount_value, icms_base,
         icms_value, ipi_value, pis_value, cofins_value, cfop, status, xml_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.access_key, data.model, data.series, data.number, data.issue_date, data.entry_date, data.operation_type,
          data.supplier_id, data.supplier_name, data.supplier_cnpj, data.supplier_ie, data.client_name, data.client_cnpj,
          data.total_products, data.total_invoice, data.freight_value, data.discount_value, data.icms_base, data.icms_value,
          data.ipi_value, data.pis_value, data.cofins_value, data.cfop, 'conferencia', data.xml_url
        ]
      );
      invoiceId = result.insertId;
    }

    for (const item of data.items || []) {
      await conn.query(
        `INSERT INTO fiscal_invoice_items
        (invoice_id, item_number, product_code, description, ncm, cfop, unit, quantity, unit_value, total_value, icms_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId, item.item_number, clean(item.product_code), clean(item.description), clean(item.ncm), clean(item.cfop),
          clean(item.unit), num(item.quantity), num(item.unit_value), num(item.total_value), num(item.icms_value)
        ]
      );
    }

    await conn.commit();
    await audit(req.user.id, 'import', 'fiscal_invoice', invoiceId, `XML NF-e ${data.number || invoiceId} importado`);
    res.status(201).json({ id: invoiceId, invoice: data });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao importar XML da NF-e' });
  } finally {
    conn.release();
  }
});

module.exports = router;
