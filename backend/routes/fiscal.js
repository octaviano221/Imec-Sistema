const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const PDFDocument = require('pdfkit');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

const writeRoles = ['admin', 'rh', 'engenharia'];

const UF_CODES = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53'
};

function sefazConfig() {
  const certPath = clean(process.env.SEFAZ_CERT_PATH);
  const resolvedCertPath = resolveSefazCertPath(certPath);
  return {
    enabled: String(process.env.SEFAZ_ENABLED || '').toLowerCase() === 'true',
    cnpj: digits(process.env.SEFAZ_CNPJ),
    uf: clean(process.env.SEFAZ_UF || 'SP'),
    environment: clean(process.env.SEFAZ_ENV || 'production'),
    endpoint: clean(process.env.SEFAZ_DFE_URL),
    cert_path: certPath,
    cert_resolved_path: resolvedCertPath,
    cert_password_set: Boolean(process.env.SEFAZ_CERT_PASSWORD),
    cert_exists: Boolean(resolvedCertPath)
  };
}

function sefazMissing(config) {
  const missing = [];
  if (!config.enabled) missing.push('SEFAZ_ENABLED=true');
  if (!config.cnpj) missing.push('SEFAZ_CNPJ');
  if (!config.uf) missing.push('SEFAZ_UF');
  if (!config.cert_path) missing.push('SEFAZ_CERT_PATH');
  if (!config.cert_password_set) missing.push('SEFAZ_CERT_PASSWORD');
  if (config.cert_path && !config.cert_exists) missing.push('arquivo .pfx nao encontrado no caminho informado');
  return missing;
}

function resolveSefazCertPath(configuredPath) {
  const candidates = [];
  const add = (value) => {
    const item = clean(value);
    if (item && !candidates.includes(item)) candidates.push(item);
  };

  add(configuredPath);

  const uploadDir = clean(process.env.UPLOAD_DIR);
  const homeDir = uploadDir ? path.dirname(uploadDir) : null;
  const appDir = process.cwd();
  const domainDir = path.basename(appDir) === 'nodejs' ? path.dirname(appDir) : appDir;
  const configuredName = configuredPath ? path.basename(configuredPath) : null;
  const names = [configuredName, 'IMECBASE.pfx', 'imec-a1.pfx'].filter(Boolean);
  const dirs = [
    homeDir && path.join(homeDir, 'certificados'),
    homeDir && path.join(homeDir, 'certificates'),
    path.join(appDir, 'certificados'),
    path.join(appDir, 'certificates'),
    path.join(domainDir, 'certificados'),
    path.join(domainDir, 'certificates'),
    path.join(domainDir, 'uploads-imec', 'certificados'),
    path.join(domainDir, 'uploads-imec', 'certificates')
  ].filter(Boolean);

  dirs.forEach((dir) => names.forEach((name) => add(path.join(dir, name))));

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch (err) {
      // Keep testing the remaining candidate paths.
    }
  }

  for (const dir of dirs) {
    try {
      const found = fs.readdirSync(dir).find((file) => /\.pfx$/i.test(file) || /\.p12$/i.test(file));
      if (found) return path.join(dir, found);
    } catch (err) {
      // Directory may not exist or may not be readable in this host.
    }
  }

  return null;
}

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

function firstAttr(text, attr) {
  const match = String(text || '').match(new RegExp(attr + '=["\']([^"\']+)["\']', 'i'));
  return match ? decodeXml(match[1]) : null;
}

function nfeKeyParts(accessKey) {
  const key = digits(accessKey);
  if (key.length !== 44) return {};
  return {
    model: key.slice(20, 22),
    series: String(Number(key.slice(22, 25)) || key.slice(22, 25)),
    number: String(Number(key.slice(25, 34)) || key.slice(25, 34))
  };
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

function parseSefazSummaryXml(rawXml) {
  const xml = stripNs(rawXml);
  const accessKey = firstTag(xml, 'chNFe');
  const keyParts = nfeKeyParts(accessKey);
  const supplierCnpj = digits(firstTag(xml, 'CNPJ') || firstTag(xml, 'CPF'));
  return {
    access_key: accessKey,
    model: keyParts.model || '55',
    series: keyParts.series || null,
    number: keyParts.number || null,
    issue_date: normalizeDate(firstTag(xml, 'dhEmi') || firstTag(xml, 'dEmi')),
    entry_date: null,
    operation_type: firstTag(xml, 'tpNF') === '1' ? 'Saida' : 'Entrada',
    supplier_name: firstTag(xml, 'xNome'),
    supplier_cnpj: supplierCnpj,
    supplier_ie: firstTag(xml, 'IE'),
    client_name: null,
    client_cnpj: null,
    total_products: num(firstTag(xml, 'vNF')),
    total_invoice: num(firstTag(xml, 'vNF')),
    freight_value: 0,
    discount_value: 0,
    icms_base: 0,
    icms_value: 0,
    ipi_value: 0,
    pis_value: 0,
    cofins_value: 0,
    cfop: null,
    items: []
  };
}

function sefazEndpoint(config) {
  if (config.endpoint) return config.endpoint;
  if (String(config.environment).toLowerCase().startsWith('hom')) {
    return 'https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
  }
  return 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
}

function sefazAmbiente(config) {
  return String(config.environment).toLowerCase().startsWith('hom') ? '2' : '1';
}

function padNsu(value) {
  return String(digits(value) || '0').padStart(15, '0').slice(-15);
}

function buildSefazEnvelope(config, ultNsu) {
  const ufCode = UF_CODES[String(config.uf || '').toUpperCase()];
  if (!ufCode) throw new Error('UF SEFAZ invalida. Use a sigla, por exemplo SP.');
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${sefazAmbiente(config)}</tpAmb>
          <cUFAutor>${ufCode}</cUFAutor>
          <CNPJ>${config.cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${padNsu(ultNsu)}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

function postSefaz(config, body) {
  const endpoint = new URL(sefazEndpoint(config));
  const payload = Buffer.from(body, 'utf8');
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      port: endpoint.port || 443,
      path: endpoint.pathname + endpoint.search,
      method: 'POST',
      pfx: fs.readFileSync(config.cert_resolved_path || config.cert_path),
      passphrase: process.env.SEFAZ_CERT_PASSWORD,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        'Content-Length': payload.length
      },
      timeout: 45000
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode >= 400) {
          return reject(new Error(`SEFAZ HTTP ${response.statusCode}: ${text.slice(0, 300)}`));
        }
        resolve(text);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado na consulta SEFAZ')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function parseDocZipBlocks(responseXml) {
  const docs = [];
  const regex = /<(?:[A-Za-z0-9_.-]+:)?docZip\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?docZip>/gi;
  let match;
  while ((match = regex.exec(responseXml))) {
    const attrs = match[1] || '';
    const encoded = String(match[2] || '').replace(/\s/g, '');
    let xml = '';
    const zipped = Buffer.from(encoded, 'base64');
    try {
      xml = zlib.gunzipSync(zipped).toString('utf8');
    } catch (err) {
      try {
        xml = zlib.inflateSync(zipped).toString('utf8');
      } catch (innerErr) {
        xml = zipped.toString('utf8');
      }
    }
    docs.push({
      nsu: firstAttr(attrs, 'NSU'),
      schema: firstAttr(attrs, 'schema'),
      xml: xml.replace(/^\uFEFF/, '').trim()
    });
  }
  return docs;
}

function parseSefazResponse(responseXml) {
  const xml = stripNs(responseXml);
  return {
    cStat: firstTag(xml, 'cStat'),
    xMotivo: firstTag(xml, 'xMotivo'),
    ultNSU: padNsu(firstTag(xml, 'ultNSU')),
    maxNSU: padNsu(firstTag(xml, 'maxNSU')),
    docs: parseDocZipBlocks(responseXml)
  };
}

function saveSefazXml(rawXml, nsu, accessKey) {
  const dir = upload.uploadDir || path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const name = `sefaz-${padNsu(nsu)}-${digits(accessKey) || Date.now()}.xml`;
  fs.writeFileSync(path.join(dir, name), rawXml, 'utf8');
  return '/uploads/' + name;
}

function resolveFiscalXmlPath(value) {
  const raw = clean(value);
  if (!raw) return null;

  const uploadDir = path.resolve(upload.uploadDir || path.join(__dirname, '..', 'uploads'));
  const asUploadFile = (fileName) => {
    const safeName = path.basename(decodeURIComponent(String(fileName || '')));
    if (!safeName || !/\.xml$/i.test(safeName)) return null;
    return path.join(uploadDir, safeName);
  };

  try {
    const parsed = new URL(raw);
    if (parsed.pathname && parsed.pathname.startsWith('/uploads/')) {
      return asUploadFile(parsed.pathname.split('/').pop());
    }
  } catch (err) {
    // Not a full URL. It can still be a local upload path.
  }

  if (raw.startsWith('/uploads/')) {
    return asUploadFile(raw.split('/').pop());
  }

  const absolute = path.resolve(raw);
  if (absolute.startsWith(uploadDir + path.sep) && /\.xml$/i.test(absolute)) {
    return absolute;
  }

  return null;
}

async function ensureSefazState(conn, config) {
  const [rows] = await conn.query('SELECT * FROM fiscal_sefaz_state WHERE cnpj=? LIMIT 1', [config.cnpj]);
  if (rows.length) return rows[0];
  await conn.query('INSERT INTO fiscal_sefaz_state (cnpj, uf, ult_nsu) VALUES (?, ?, ?)', [config.cnpj, String(config.uf).toUpperCase(), '000000000000000']);
  return { cnpj: config.cnpj, uf: String(config.uf).toUpperCase(), ult_nsu: '000000000000000', max_nsu: null };
}

async function saveParsedFiscalInvoice(conn, data, options = {}) {
  if (!data.access_key && !data.number) throw new Error('Nota fiscal sem chave ou numero');
  data.supplier_id = await findOrCreateSupplier(conn, data);

  let invoiceId = null;
  if (data.access_key) {
    const [existing] = await conn.query('SELECT id FROM fiscal_invoices WHERE access_key=? LIMIT 1', [data.access_key]);
    invoiceId = existing[0] && existing[0].id;
  }

  const status = options.status || 'conferencia';
  const notes = clean(options.notes || data.notes);
  if (invoiceId) {
    await conn.query(
      `UPDATE fiscal_invoices SET model=?, series=?, number=?, issue_date=?, entry_date=?, operation_type=?,
       supplier_id=?, supplier_name=?, supplier_cnpj=?, supplier_ie=?, client_name=?, client_cnpj=?,
       total_products=?, total_invoice=?, freight_value=?, discount_value=?, icms_base=?, icms_value=?,
       ipi_value=?, pis_value=?, cofins_value=?, cfop=?, status=?, xml_url=?, notes=COALESCE(?, notes)
       WHERE id=?`,
      [
        data.model, data.series, data.number, data.issue_date, data.entry_date, data.operation_type,
        data.supplier_id, data.supplier_name, data.supplier_cnpj, data.supplier_ie, data.client_name, data.client_cnpj,
        data.total_products, data.total_invoice, data.freight_value, data.discount_value, data.icms_base, data.icms_value,
        data.ipi_value, data.pis_value, data.cofins_value, data.cfop, status, data.xml_url, notes, invoiceId
      ]
    );
    await conn.query('DELETE FROM fiscal_invoice_items WHERE invoice_id=?', [invoiceId]);
  } else {
    const [result] = await conn.query(
      `INSERT INTO fiscal_invoices
      (access_key, model, series, number, issue_date, entry_date, operation_type, supplier_id, supplier_name, supplier_cnpj,
       supplier_ie, client_name, client_cnpj, total_products, total_invoice, freight_value, discount_value, icms_base,
       icms_value, ipi_value, pis_value, cofins_value, cfop, status, xml_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.access_key, data.model, data.series, data.number, data.issue_date, data.entry_date, data.operation_type,
        data.supplier_id, data.supplier_name, data.supplier_cnpj, data.supplier_ie, data.client_name, data.client_cnpj,
        data.total_products, data.total_invoice, data.freight_value, data.discount_value, data.icms_base, data.icms_value,
        data.ipi_value, data.pis_value, data.cofins_value, data.cfop, status, data.xml_url, notes
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

  return { invoiceId, action: options.existed ? 'updated' : (invoiceId ? 'saved' : 'ignored') };
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

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '-';
  const cleanValue = String(value).split('T')[0].slice(0, 10);
  const parts = cleanValue.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : cleanValue;
}

function formatDocument(value) {
  const d = digits(value);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return value || '-';
}

function shortText(value, fallback = '-') {
  const text = clean(value);
  return text || fallback;
}

function drawBox(doc, x, y, w, h, title, value, options = {}) {
  doc.roundedRect(x, y, w, h, 4).strokeColor('#d8e2f0').lineWidth(0.7).stroke();
  doc.fillColor('#53657d').font('Helvetica-Bold').fontSize(7).text(String(title || '').toUpperCase(), x + 7, y + 6, { width: w - 14 });
  doc.fillColor(options.color || '#0b2344').font(options.bold === false ? 'Helvetica' : 'Helvetica-Bold').fontSize(options.size || 9)
    .text(String(value || '-'), x + 7, y + 19, { width: w - 14, height: h - 24 });
}

function drawTableHeader(doc, y) {
  const cols = [
    [36, 28, 'ITEM'],
    [64, 58, 'CODIGO'],
    [122, 184, 'DESCRICAO'],
    [306, 38, 'NCM'],
    [344, 32, 'CFOP'],
    [376, 38, 'QTD'],
    [414, 36, 'UN'],
    [450, 53, 'UNITARIO'],
    [503, 56, 'TOTAL']
  ];
  doc.rect(36, y, 523, 20).fill('#eef4fb');
  doc.fillColor('#263b58').font('Helvetica-Bold').fontSize(6.5);
  cols.forEach(([x, w, label]) => doc.text(label, x + 3, y + 7, { width: w - 6, align: x >= 414 ? 'right' : 'left' }));
  doc.strokeColor('#c8d5e6').lineWidth(0.5).rect(36, y, 523, 20).stroke();
}

function drawFiscalDanfe(doc, invoice, items) {
  const pageBottom = 790;
  const supplier = shortText(invoice.linked_supplier_name || invoice.supplier_name);
  const fileNumber = shortText(invoice.number, String(invoice.id));
  const accessKey = digits(invoice.access_key);

  doc.fillColor('#0b2344').font('Helvetica-Bold').fontSize(18).text('DANFE', 36, 34);
  doc.fontSize(8).fillColor('#53657d').text('Documento Auxiliar da Nota Fiscal Eletronica', 36, 56);
  doc.roundedRect(410, 32, 149, 42, 6).fill('#0b4fb3');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text('IMEC COMPLIANCE', 426, 43);
  doc.font('Helvetica').fontSize(7).text('Modulo fiscal e almoxarifado', 426, 57);

  doc.roundedRect(36, 86, 523, 66, 5).strokeColor('#0b2344').lineWidth(1).stroke();
  doc.fillColor('#0b2344').font('Helvetica-Bold').fontSize(10).text('NF-e ' + fileNumber, 48, 98);
  doc.fillColor('#53657d').font('Helvetica').fontSize(8).text('Serie ' + shortText(invoice.series) + ' | Modelo ' + shortText(invoice.model, '55'), 48, 115);
  doc.font('Helvetica-Bold').fontSize(7).text('CHAVE DE ACESSO', 190, 98);
  doc.font('Courier-Bold').fontSize(10).fillColor('#0b2344').text(accessKey || 'Chave nao informada', 190, 113, { width: 350 });
  doc.fillColor('#53657d').font('Helvetica').fontSize(7).text('PDF gerado pelo sistema IMEC para conferencia interna. Consulte a validade fiscal no portal oficial da NF-e.', 48, 136, { width: 495 });

  let y = 166;
  drawBox(doc, 36, y, 252, 46, 'Emitente / Fornecedor', supplier + '\n' + formatDocument(invoice.supplier_cnpj), { size: 8.5 });
  drawBox(doc, 300, y, 259, 46, 'Destinatario', shortText(invoice.client_name, 'IMEC Servicos de Manutencao Industrial Ltda.') + '\n' + formatDocument(invoice.client_cnpj), { size: 8.5 });
  y += 56;

  drawBox(doc, 36, y, 120, 40, 'Emissao', formatDate(invoice.issue_date));
  drawBox(doc, 166, y, 120, 40, 'Entrada', formatDate(invoice.entry_date));
  drawBox(doc, 296, y, 120, 40, 'Natureza da operacao', shortText(invoice.operation_type));
  drawBox(doc, 426, y, 133, 40, 'Status', shortText(invoice.status, 'conferencia'));
  y += 52;

  drawBox(doc, 36, y, 100, 40, 'Total produtos', formatMoney(invoice.total_products));
  drawBox(doc, 146, y, 100, 40, 'Frete', formatMoney(invoice.freight_value));
  drawBox(doc, 256, y, 100, 40, 'Desconto', formatMoney(invoice.discount_value));
  drawBox(doc, 366, y, 90, 40, 'ICMS', formatMoney(invoice.icms_value));
  drawBox(doc, 466, y, 93, 40, 'Total NF-e', formatMoney(invoice.total_invoice), { color: '#0b4fb3', size: 10 });
  y += 58;

  doc.fillColor('#0b2344').font('Helvetica-Bold').fontSize(11).text('Produtos e servicos', 36, y);
  y += 18;
  drawTableHeader(doc, y);
  y += 20;

  const rows = items && items.length ? items : [{
    item_number: 1,
    product_code: '-',
    description: invoice.notes && /Resumo importado da SEFAZ/i.test(invoice.notes)
      ? 'Resumo SEFAZ importado. XML completo ainda nao recebido para detalhar os produtos.'
      : 'Itens nao cadastrados para esta nota.',
    ncm: '-',
    cfop: invoice.cfop || '-',
    quantity: 0,
    unit: '-',
    unit_value: 0,
    total_value: invoice.total_invoice || 0
  }];

  rows.forEach((item) => {
    const desc = shortText(item.description);
    const rowHeight = Math.max(24, doc.heightOfString(desc, { width: 176, fontSize: 7 }) + 12);
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = 42;
      drawTableHeader(doc, y);
      y += 20;
    }
    doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(36, y, 523, rowHeight).stroke();
    doc.fillColor('#0b2344').font('Helvetica').fontSize(7);
    doc.text(String(item.item_number || '-'), 39, y + 8, { width: 22 });
    doc.text(shortText(item.product_code), 67, y + 8, { width: 52 });
    doc.text(desc, 125, y + 8, { width: 176 });
    doc.text(shortText(item.ncm), 309, y + 8, { width: 32 });
    doc.text(shortText(item.cfop), 347, y + 8, { width: 26 });
    doc.text(String(num(item.quantity) || '-'), 379, y + 8, { width: 32, align: 'right' });
    doc.text(shortText(item.unit), 417, y + 8, { width: 30, align: 'right' });
    doc.text(formatMoney(item.unit_value), 453, y + 8, { width: 47, align: 'right' });
    doc.font('Helvetica-Bold').text(formatMoney(item.total_value), 506, y + 8, { width: 50, align: 'right' });
    y += rowHeight;
  });

  y += 18;
  if (y + 106 > pageBottom) {
    doc.addPage();
    y = 42;
  }
  doc.roundedRect(36, y, 523, 78, 5).strokeColor('#d8e2f0').lineWidth(0.7).stroke();
  doc.fillColor('#0b2344').font('Helvetica-Bold').fontSize(9).text('Observacoes fiscais', 48, y + 12);
  doc.fillColor('#53657d').font('Helvetica').fontSize(8).text(shortText(invoice.notes, 'Sem observacoes.'), 48, y + 28, { width: 495, height: 42 });
  y += 94;
  doc.fillColor('#71819a').font('Helvetica').fontSize(7)
    .text('Emitido em ' + new Date().toLocaleString('pt-BR') + ' pelo IMEC Compliance Industrial.', 36, y, { width: 523, align: 'center' });
}

async function getInvoiceWithItems(id) {
  const [rows] = await db.query(`
    SELECT fi.*, ss.name AS linked_supplier_name, po.order_number AS purchase_order_number
    FROM fiscal_invoices fi
    LEFT JOIN stock_suppliers ss ON ss.id = fi.supplier_id
    LEFT JOIN purchase_orders po ON po.id = fi.purchase_order_id
    WHERE fi.id = ?
    LIMIT 1
  `, [id]);
  if (!rows.length) return null;
  const [items] = await db.query('SELECT * FROM fiscal_invoice_items WHERE invoice_id=? ORDER BY COALESCE(item_number, id), id', [id]);
  return { invoice: rows[0], items };
}

function normalizeSpedText(value) {
  return String(clean(value) || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function spedMoney(value) {
  return num(value).toFixed(2).replace('.', ',');
}

function spedQty(value) {
  return Number(value || 0).toFixed(4).replace('.', ',');
}

function spedDate(value) {
  const d = normalizeDate(value);
  return d ? d.split('-').reverse().join('') : '';
}

function monthRange(month) {
  const now = new Date();
  const text = clean(month);
  const valid = /^\d{4}-\d{2}$/.test(text || '');
  const year = valid ? Number(text.slice(0, 4)) : now.getFullYear();
  const monthIndex = valid ? Number(text.slice(5, 7)) - 1 : now.getMonth();
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return {
    start: fmt(startDate),
    end: fmt(endDate),
    label: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  };
}

function selectItemConfig(items, id) {
  return (items || []).find((item) => String(item.id) === String(id)) || {};
}

async function reverseInvoiceStockMovements(conn, invoiceId) {
  const [movements] = await conn.query(
    'SELECT stock_item_id, quantity FROM stock_movements WHERE invoice_id=? AND movement_type=?',
    [invoiceId, 'entrada_nfe']
  );
  for (const movement of movements) {
    await conn.query(
      'UPDATE stock_items SET current_stock=GREATEST(current_stock - ?, 0), updated_at=NOW() WHERE id=?',
      [num(movement.quantity), movement.stock_item_id]
    );
  }
  await conn.query('DELETE FROM stock_movements WHERE invoice_id=? AND movement_type=?', [invoiceId, 'entrada_nfe']);
  await conn.query('UPDATE fiscal_invoice_items SET stock_movement_id=NULL WHERE invoice_id=?', [invoiceId]);
}

async function updateStockItemMetadata(conn, stockItemId, config) {
  if (!stockItemId || !config || typeof config !== 'object') return;
  const fields = [];
  const values = [];

  [
    ['stock_name', 'name'],
    ['stock_category', 'category'],
    ['stock_unit', 'unit'],
    ['stock_location', 'location']
  ].forEach(([source, column]) => {
    const value = clean(config[source]);
    if (!value) return;
    fields.push(`${column}=?`);
    values.push(value);
  });

  if (config.minimum_stock !== undefined && config.minimum_stock !== null && config.minimum_stock !== '') {
    fields.push('minimum_stock=?');
    values.push(num(config.minimum_stock));
  }

  if (!fields.length) return;
  values.push(stockItemId);
  await conn.query(`UPDATE stock_items SET ${fields.join(', ')}, updated_at=NOW() WHERE id=?`, values);
}

async function ensureStockItemForInvoiceItem(conn, invoice, item, config) {
  config = config || {};
  const requestedId = config.stock_item_id ? Number(config.stock_item_id) : null;
  if (requestedId) {
    await updateStockItemMetadata(conn, requestedId, config);
    return requestedId;
  }

  const description = clean(config.stock_name) || clean(item.description);
  if (!description) return null;

  const [existing] = await conn.query('SELECT id FROM stock_items WHERE name=? LIMIT 1', [description]);
  if (existing.length) {
    await updateStockItemMetadata(conn, existing[0].id, config);
    return existing[0].id;
  }

  const createMissing = config.create_stock_item !== false;
  if (!createMissing) return null;

  const [created] = await conn.query(
    `INSERT INTO stock_items
     (name, category, unit, supplier_id, current_stock, minimum_stock, average_cost, location, status, notes)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      description,
      clean(config.stock_category) || 'NF-e',
      clean(config.stock_unit) || clean(item.unit) || 'UN',
      invoice.supplier_id || null,
      num(config.minimum_stock),
      num(item.unit_value),
      clean(config.stock_location) || 'Almoxarifado',
      'ativo',
      `Criado automaticamente pela NF-e ${invoice.number || invoice.id}.`
    ]
  );
  return created.insertId;
}

async function createStockMovement(conn, invoice, item, stockItemId) {
  if (!stockItemId) return null;
  const quantity = num(item.quantity);
  if (quantity <= 0) return null;

  const [stockRows] = await conn.query('SELECT current_stock, average_cost FROM stock_items WHERE id=? LIMIT 1', [stockItemId]);
  if (!stockRows.length) return null;

  const currentStock = num(stockRows[0].current_stock);
  const currentAverage = num(stockRows[0].average_cost);
  const unitCost = num(item.unit_value);
  const newStock = currentStock + quantity;
  const newAverage = newStock > 0
    ? ((currentStock * currentAverage) + (quantity * unitCost)) / newStock
    : unitCost;

  const [movement] = await conn.query(
    `INSERT INTO stock_movements
     (stock_item_id, invoice_id, invoice_item_id, movement_type, quantity, unit_cost, total_cost, movement_date, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      stockItemId,
      invoice.id,
      item.id,
      'entrada_nfe',
      quantity,
      unitCost,
      num(item.total_value),
      normalizeDate(invoice.entry_date) || normalizeDate(invoice.issue_date) || new Date().toISOString().slice(0, 10),
      'NF-e',
      `Entrada fiscal NF-e ${invoice.number || invoice.id}.`
    ]
  );

  await conn.query(
    'UPDATE stock_items SET current_stock=?, average_cost=?, updated_at=NOW() WHERE id=?',
    [newStock, newAverage, stockItemId]
  );

  return movement.insertId;
}

async function upsertFinancePayable(conn, invoice, dueDate) {
  const description = `NF-e ${invoice.number || invoice.id} - ${invoice.supplier_name || 'Fornecedor'}`;
  if (invoice.finance_payable_id) {
    await conn.query(
      `UPDATE finance_payables
       SET supplier_id=?, supplier_name=?, supplier_cnpj=?, description=?, issue_date=?, due_date=?,
           total_amount=?, status=?, category=?, updated_at=NOW()
       WHERE id=?`,
      [
        invoice.supplier_id || null,
        clean(invoice.supplier_name),
        clean(invoice.supplier_cnpj),
        description,
        normalizeDate(invoice.issue_date),
        dueDate,
        num(invoice.total_invoice),
        'aberto',
        'nota_fiscal',
        invoice.finance_payable_id
      ]
    );
    return invoice.finance_payable_id;
  }

  const [created] = await conn.query(
    `INSERT INTO finance_payables
     (invoice_id, supplier_id, supplier_name, supplier_cnpj, description, issue_date, due_date, total_amount, paid_amount, status, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      invoice.id,
      invoice.supplier_id || null,
      clean(invoice.supplier_name),
      clean(invoice.supplier_cnpj),
      description,
      normalizeDate(invoice.issue_date),
      dueDate,
      num(invoice.total_invoice),
      'aberto',
      'nota_fiscal'
    ]
  );
  return created.insertId;
}

async function integrateFiscalInvoice(conn, invoiceId, data) {
  const [invoiceRows] = await conn.query('SELECT * FROM fiscal_invoices WHERE id=? LIMIT 1', [invoiceId]);
  if (!invoiceRows.length) {
    const error = new Error('Nota fiscal nao encontrada');
    error.status = 404;
    throw error;
  }

  const invoice = invoiceRows[0];
  const [items] = await conn.query('SELECT * FROM fiscal_invoice_items WHERE invoice_id=? ORDER BY COALESCE(item_number, id), id', [invoiceId]);
  const itemConfigs = data.items || [];
  const entryCfop = clean(data.entry_cfop) || clean(invoice.entry_cfop) || clean(invoice.cfop) || clean(items[0] && items[0].cfop);
  const dueDate = normalizeDate(data.payment_due_date) || normalizeDate(invoice.payment_due_date) || normalizeDate(invoice.entry_date) || normalizeDate(invoice.issue_date);
  const financeId = await upsertFinancePayable(conn, invoice, dueDate);

  await reverseInvoiceStockMovements(conn, invoiceId);

  let movementCount = 0;
  for (const item of items) {
    const config = selectItemConfig(itemConfigs, item.id);
    const itemEntryCfop = clean(config.entry_cfop) || entryCfop || clean(item.cfop);
    const skipStock = config.skip_stock === true || config.skip_stock === 'true';
    const stockItemId = skipStock ? null : await ensureStockItemForInvoiceItem(conn, invoice, item, config);
    const movementId = skipStock ? null : await createStockMovement(conn, invoice, item, stockItemId);
    if (movementId) movementCount += 1;

    await conn.query(
      `UPDATE fiscal_invoice_items SET
       entry_cfop=?, tax_status=?, credit_indicator=?, icms_credit_base=?, icms_credit_value=?,
       stock_item_id=?, stock_movement_id=?, fiscal_notes=?
       WHERE id=?`,
      [
        itemEntryCfop,
        clean(config.tax_status) || 'conferencia',
        clean(config.credit_indicator) || 'analisar',
        num(config.icms_credit_base != null ? config.icms_credit_base : item.icms_base || 0),
        num(config.icms_credit_value != null ? config.icms_credit_value : item.icms_value || 0),
        stockItemId,
        movementId,
        clean(config.fiscal_notes),
        item.id
      ]
    );
  }

  await conn.query(
    `UPDATE fiscal_invoices SET
     entry_cfop=?, financial_status=?, stock_status=?, fiscal_status=?, payment_due_date=?,
     finance_payable_id=?, sped_status=?, status=?, updated_at=NOW()
     WHERE id=?`,
    [
      entryCfop,
      'lancado',
      movementCount ? 'movimentado' : 'sem_movimento',
      clean(data.fiscal_status) || 'escriturado',
      dueDate,
      financeId,
      clean(data.sped_status) || 'pendente',
      'conferida',
      invoiceId
    ]
  );

  return { finance_payable_id: financeId, stock_movements: movementCount, items: items.length };
}

function buildSpedFile(periodStart, periodEnd, invoices, items, stockItems) {
  const lines = [];
  const byInvoice = {};
  (items || []).forEach((item) => {
    if (!byInvoice[item.invoice_id]) byInvoice[item.invoice_id] = [];
    byInvoice[item.invoice_id].push(item);
  });

  lines.push(`|0000|017|0|${spedDate(periodStart)}|${spedDate(periodEnd)}|IMEC INDUSTRIA DE BASE METALURGICA EIRELI|34756390000146|SP|`);
  lines.push('|0001|0|');
  lines.push('|C001|0|');

  (invoices || []).forEach((invoice) => {
    lines.push([
      '', 'C100', '0', '1', digits(invoice.supplier_cnpj), invoice.model || '55', '00',
      normalizeSpedText(invoice.series), normalizeSpedText(invoice.number), digits(invoice.access_key),
      spedDate(invoice.issue_date), spedDate(invoice.entry_date || invoice.issue_date),
      spedMoney(invoice.total_invoice), '0', '0', spedMoney(invoice.total_products),
      spedMoney(invoice.freight_value), spedMoney(invoice.discount_value), spedMoney(invoice.icms_value), ''
    ].join('|'));

    (byInvoice[invoice.id] || []).forEach((item) => {
      lines.push([
        '', 'C170',
        normalizeSpedText(item.item_number || item.id),
        normalizeSpedText(item.description),
        spedQty(item.quantity),
        normalizeSpedText(item.unit || 'UN'),
        spedMoney(item.total_value),
        '0',
        '0',
        normalizeSpedText(item.entry_cfop || item.cfop),
        normalizeSpedText(item.ncm),
        spedMoney(item.icms_credit_base || item.icms_base || 0),
        spedMoney(item.icms_credit_value || item.icms_value || 0),
        normalizeSpedText(item.credit_indicator || 'ANALISAR'),
        ''
      ].join('|'));
    });
  });

  lines.push(`|C990|${lines.filter((line) => line.startsWith('|C')).length + 1}|`);
  lines.push('|H001|0|');
  const stockTotal = (stockItems || []).reduce((sum, item) => sum + (num(item.current_stock) * num(item.average_cost)), 0);
  lines.push(`|H005|${spedDate(periodEnd)}|${spedMoney(stockTotal)}|01|`);
  (stockItems || []).forEach((item) => {
    lines.push(`|H010|${item.id}|${normalizeSpedText(item.unit || 'UN')}|${spedQty(item.current_stock)}|${spedMoney(item.average_cost)}|${spedMoney(num(item.current_stock) * num(item.average_cost))}|0|`);
  });
  lines.push(`|H990|${lines.filter((line) => line.startsWith('|H')).length + 1}|`);
  lines.push('|K001|0|');
  (stockItems || []).forEach((item) => {
    lines.push(`|K200|${spedDate(periodEnd)}|${item.id}|${spedQty(item.current_stock)}|0|`);
  });
  lines.push(`|K990|${lines.filter((line) => line.startsWith('|K')).length + 1}|`);
  lines.push(`|9999|${lines.length + 1}|`);

  return {
    file_content: lines.join('\r\n') + '\r\n',
    summary: {
      invoices: invoices.length,
      items: items.length,
      stock_items: stockItems.length,
      total_invoices: invoices.reduce((sum, invoice) => sum + num(invoice.total_invoice), 0),
      stock_total: stockTotal
    }
  };
}

router.get('/summary', authenticate, async (req, res) => {
  try {
    const invoices = await listInvoices();
    const [payables] = await db.query("SELECT COUNT(*) count, COALESCE(SUM(total_amount - paid_amount),0) total FROM finance_payables WHERE status <> 'pago'");
    const [movements] = await db.query("SELECT COUNT(*) count FROM stock_movements WHERE movement_type='entrada_nfe'");
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthInvoices = invoices.filter((invoice) => {
      if (!invoice.issue_date) return false;
      const d = new Date(invoice.issue_date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const pending = invoices.filter((invoice) => invoice.status === 'conferencia' || invoice.status === 'pendente');
    const divergent = invoices.filter((invoice) => invoice.status === 'divergente');
    const supplierNames = new Set(invoices.map((invoice) => invoice.supplier_cnpj || invoice.supplier_name).filter(Boolean));
    res.json({
      invoices,
      metrics: {
        invoices: invoices.length,
        month_total: monthInvoices.reduce((sum, invoice) => sum + num(invoice.total_invoice), 0),
        icms_value: invoices.reduce((sum, invoice) => sum + num(invoice.icms_value), 0),
        pending: pending.length,
        divergent: divergent.length,
        suppliers: supplierNames.size,
        with_xml: invoices.filter((invoice) => invoice.xml_url).length,
        unlinked_orders: invoices.filter((invoice) => !invoice.purchase_order_id).length,
        conference_total: pending.concat(divergent).reduce((sum, invoice) => sum + num(invoice.total_invoice), 0),
        integrated: invoices.filter((invoice) => invoice.fiscal_status === 'escriturado').length,
        finance_open: Number(payables[0] && payables[0].count) || 0,
        finance_open_total: Number(payables[0] && payables[0].total) || 0,
        stock_movements: Number(movements[0] && movements[0].count) || 0,
        sped_pending: invoices.filter((invoice) => invoice.sped_status === 'pendente').length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar modulo fiscal' });
  }
});

router.get('/reports/summary', authenticate, async (req, res) => {
  try {
    const range = monthRange(req.query && req.query.month);
    const [invoiceRows] = await db.query(
      `SELECT *
       FROM fiscal_invoices
       WHERE COALESCE(entry_date, issue_date, DATE(created_at)) BETWEEN ? AND ?
       ORDER BY COALESCE(entry_date, issue_date, created_at), id`,
      [range.start, range.end]
    );
    const invoiceIds = invoiceRows.map((row) => row.id);
    let itemRows = [];
    let payableRows = [];
    let movementRows = [];

    if (invoiceIds.length) {
      const placeholders = invoiceIds.map(() => '?').join(',');
      const [items] = await db.query(
        `SELECT fii.*, fi.number AS invoice_number, fi.series AS invoice_series, fi.supplier_name
         FROM fiscal_invoice_items fii
         JOIN fiscal_invoices fi ON fi.id = fii.invoice_id
         WHERE fii.invoice_id IN (${placeholders})
         ORDER BY fii.invoice_id, COALESCE(fii.item_number, fii.id), fii.id`,
        invoiceIds
      );
      itemRows = items;

      const [payables] = await db.query(
        `SELECT fp.*, fi.number AS invoice_number, fi.series AS invoice_series, fi.supplier_name
         FROM finance_payables fp
         LEFT JOIN fiscal_invoices fi ON fi.id = fp.invoice_id
         WHERE fp.invoice_id IN (${placeholders})
         ORDER BY COALESCE(fp.due_date, fp.issue_date, fp.created_at), fp.id`,
        invoiceIds
      );
      payableRows = payables;

      const [movements] = await db.query(
        `SELECT sm.*, si.name AS stock_item_name, si.unit, fi.number AS invoice_number,
                fii.description AS invoice_item_description
         FROM stock_movements sm
         LEFT JOIN stock_items si ON si.id = sm.stock_item_id
         LEFT JOIN fiscal_invoices fi ON fi.id = sm.invoice_id
         LEFT JOIN fiscal_invoice_items fii ON fii.id = sm.invoice_item_id
         WHERE sm.invoice_id IN (${placeholders})
         ORDER BY COALESCE(sm.movement_date, sm.created_at), sm.id`,
        invoiceIds
      );
      movementRows = movements;
    }

    const [stockItems] = await db.query("SELECT * FROM stock_items WHERE status <> 'inativo' ORDER BY name");
    const [spedExports] = await db.query(
      `SELECT id, period_start, period_end, file_name, status, summary, created_at
       FROM fiscal_sped_exports
       WHERE period_start >= ? AND period_end <= ?
       ORDER BY created_at DESC, id DESC`,
      [range.start, range.end]
    );

    const invoiceById = new Map(invoiceRows.map((invoice) => [String(invoice.id), invoice]));
    const payableInvoiceIds = new Set(payableRows.map((row) => String(row.invoice_id)).filter(Boolean));
    const movementInvoiceIds = new Set(movementRows.map((row) => String(row.invoice_id)).filter(Boolean));
    const cfopSummary = {};
    const icmsSummary = {};

    itemRows.forEach((item) => {
      const cfop = String(item.entry_cfop || item.cfop || '-');
      if (!cfopSummary[cfop]) cfopSummary[cfop] = { cfop, count: 0, total: 0, icms_credit: 0 };
      cfopSummary[cfop].count += 1;
      cfopSummary[cfop].total += num(item.total_value);
      cfopSummary[cfop].icms_credit += num(item.icms_credit_value || item.icms_value);

      const credit = String(item.credit_indicator || 'analisar');
      if (!icmsSummary[credit]) icmsSummary[credit] = { credit_indicator: credit, count: 0, base: 0, value: 0 };
      icmsSummary[credit].count += 1;
      icmsSummary[credit].base += num(item.icms_credit_base || item.icms_base);
      icmsSummary[credit].value += num(item.icms_credit_value || item.icms_value);
    });

    const withoutFinance = invoiceRows.filter((invoice) => !payableInvoiceIds.has(String(invoice.id)));
    const withoutStock = invoiceRows.filter((invoice) => !movementInvoiceIds.has(String(invoice.id)) && (invoice.stock_status || 'nao_lancado') !== 'sem_movimento');
    const withoutCfop = itemRows.filter((item) => !(item.entry_cfop || item.cfop));
    const withoutIcmsDecision = itemRows.filter((item) => !item.credit_indicator || item.credit_indicator === 'analisar');
    const spedPending = invoiceRows.filter((invoice) => (invoice.sped_status || 'pendente') === 'pendente');
    const openPayables = payableRows.filter((row) => row.status !== 'pago' && row.status !== 'cancelado');
    const paidPayables = payableRows.filter((row) => row.status === 'pago');

    res.json({
      period: range,
      metrics: {
        total_invoices: invoiceRows.length,
        total_value: invoiceRows.reduce((sum, invoice) => sum + num(invoice.total_invoice), 0),
        total_icms: invoiceRows.reduce((sum, invoice) => sum + num(invoice.icms_value), 0),
        open_payables: openPayables.length,
        open_payables_total: openPayables.reduce((sum, row) => sum + Math.max(num(row.total_amount) - num(row.paid_amount), 0), 0),
        paid_payables: paidPayables.length,
        stock_entries: movementRows.length,
        stock_items: stockItems.length,
        sped_exports: spedExports.length,
        pending_entries: invoiceRows.filter((invoice) => (invoice.fiscal_status || 'conferencia') !== 'escriturado' || (invoice.financial_status || 'nao_lancado') !== 'lancado').length,
        pending_sped: spedPending.length,
        missing_cfop: withoutCfop.length,
        missing_icms_decision: withoutIcmsDecision.length
      },
      cfop_summary: Object.keys(cfopSummary).map((key) => cfopSummary[key]).sort((a, b) => b.total - a.total),
      icms_summary: Object.keys(icmsSummary).map((key) => icmsSummary[key]).sort((a, b) => b.value - a.value),
      issues: {
        without_finance: withoutFinance.slice(0, 20),
        without_stock: withoutStock.slice(0, 20),
        without_cfop: withoutCfop.slice(0, 30).map((item) => ({ ...item, invoice: invoiceById.get(String(item.invoice_id)) || null })),
        without_icms_decision: withoutIcmsDecision.slice(0, 30).map((item) => ({ ...item, invoice: invoiceById.get(String(item.invoice_id)) || null })),
        sped_pending: spedPending.slice(0, 30)
      },
      invoices: invoiceRows,
      payables: payableRows,
      stock_movements: movementRows,
      sped_exports: spedExports.map((row) => {
        let summary = row.summary;
        if (typeof summary === 'string') {
          try { summary = JSON.parse(summary); } catch (_) { summary = {}; }
        }
        return { ...row, summary: summary || {} };
      })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar conferencia fiscal' });
  }
});

router.get('/invoices', authenticate, async (req, res) => {
  try {
    res.json(await listInvoices());
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar notas fiscais' });
  }
});

router.get('/invoices/:id', authenticate, async (req, res) => {
  try {
    const result = await getInvoiceWithItems(req.params.id);
    if (!result) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar nota fiscal' });
  }
});

router.get('/invoices/:id/danfe.pdf', authenticate, async (req, res) => {
  try {
    const result = await getInvoiceWithItems(req.params.id);
    if (!result) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });

    const { invoice, items } = result;
    const safeNumber = String(invoice.number || invoice.id).replace(/[^\w.-]+/g, '-');

    await audit(req.user.id, 'download', 'fiscal_invoice', invoice.id, `DANFE NF-e ${invoice.number || invoice.id} gerado`);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: `DANFE NF-e ${safeNumber}`,
        Author: 'IMEC Compliance Industrial'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="danfe-nfe-${safeNumber}.pdf"`);

    doc.on('error', (err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).end();
    });

    doc.pipe(res);
    drawFiscalDanfe(doc, invoice, items);
    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar PDF da nota fiscal' });
  }
});

router.get('/invoices/:id/xml', authenticate, async (req, res) => {
  try {
    const result = await getInvoiceWithItems(req.params.id);
    if (!result) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });

    const { invoice } = result;
    const xmlPath = resolveFiscalXmlPath(invoice.xml_url);
    if (!xmlPath || !fs.existsSync(xmlPath)) {
      return res.status(404).json({ error: 'XML da nota fiscal nao encontrado no servidor' });
    }

    const safeNumber = String(invoice.number || invoice.id).replace(/[^\w.-]+/g, '-');
    const safeKey = digits(invoice.access_key);
    const filename = safeKey ? `nfe-${safeKey}.xml` : `nfe-${safeNumber}.xml`;

    await audit(req.user.id, 'download', 'fiscal_invoice', invoice.id, `XML NF-e ${invoice.number || invoice.id} baixado`);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(xmlPath).pipe(res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao baixar XML da nota fiscal' });
  }
});

router.post('/invoices/:id/integrate', authenticate, authorize(...writeRoles), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await integrateFiscalInvoice(conn, req.params.id, req.body || {});
    await conn.commit();
    await audit(req.user.id, 'integrate', 'fiscal_invoice', req.params.id, 'Nota fiscal integrada ao financeiro, estoque e fiscal');
    res.json({ success: true, ...result });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao escriturar nota fiscal' });
  } finally {
    conn.release();
  }
});

router.get('/finance/payables', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT fp.*, fi.number AS invoice_number, fi.series AS invoice_series, fi.access_key
       FROM finance_payables fp
       LEFT JOIN fiscal_invoices fi ON fi.id = fp.invoice_id
       ORDER BY COALESCE(fp.due_date, fp.issue_date, fp.created_at) DESC, fp.id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar financeiro fiscal' });
  }
});

router.put('/finance/payables/:id', authenticate, authorize(...writeRoles), async (req, res) => {
  try {
    const allowed = new Set(['aberto', 'parcial', 'pago', 'cancelado', 'vencido']);
    const status = allowed.has(req.body && req.body.status) ? req.body.status : 'aberto';
    const paidAmount = num(req.body && req.body.paid_amount);
    const notes = (req.body && req.body.notes) || null;
    const [currentRows] = await db.query('SELECT * FROM finance_payables WHERE id=?', [req.params.id]);
    if (!currentRows.length) return res.status(404).json({ error: 'Titulo financeiro nao encontrado' });

    await db.query(
      `UPDATE finance_payables
       SET status=?, paid_amount=?, notes=?, updated_at=NOW()
       WHERE id=?`,
      [status, paidAmount, notes, req.params.id]
    );

    if (currentRows[0].invoice_id) {
      await db.query(
        `UPDATE fiscal_invoices
         SET financial_status='lancado',
             status=CASE WHEN status='pendente' THEN 'conferencia' ELSE status END
         WHERE id=?`,
        [currentRows[0].invoice_id]
      );
    }

    const [rows] = await db.query(
      `SELECT fp.*, fi.number AS invoice_number, fi.series AS invoice_series, fi.access_key
       FROM finance_payables fp
       LEFT JOIN fiscal_invoices fi ON fi.id = fp.invoice_id
       WHERE fp.id=?`,
      [req.params.id]
    );
    await audit(req.user.id, 'update', 'finance_payable', req.params.id, `Titulo fiscal ${status}`);
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar financeiro fiscal' });
  }
});

router.get('/stock/movements', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sm.*, si.name AS stock_item_name, si.unit, fi.number AS invoice_number, fii.description AS invoice_item_description
       FROM stock_movements sm
       LEFT JOIN stock_items si ON si.id = sm.stock_item_id
       LEFT JOIN fiscal_invoices fi ON fi.id = sm.invoice_id
       LEFT JOIN fiscal_invoice_items fii ON fii.id = sm.invoice_item_id
       ORDER BY COALESCE(sm.movement_date, sm.created_at) DESC, sm.id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar estoque fiscal' });
  }
});

router.get('/sped/exports', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, period_start, period_end, file_name, status, summary, created_at
       FROM fiscal_sped_exports
       ORDER BY created_at DESC, id DESC
       LIMIT 24`
    );
    res.json(rows.map((row) => {
      let summary = row.summary;
      if (typeof summary === 'string') {
        try { summary = JSON.parse(summary); } catch (_) { summary = {}; }
      }
      return { ...row, summary: summary || {} };
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar historico SPED' });
  }
});

router.post('/sped/export', authenticate, authorize(...writeRoles), async (req, res) => {
  try {
    const range = monthRange(req.body && req.body.month);
    const [invoiceRows] = await db.query(
      `SELECT * FROM fiscal_invoices
       WHERE fiscal_status='escriturado'
         AND COALESCE(entry_date, issue_date, DATE(created_at)) BETWEEN ? AND ?
       ORDER BY COALESCE(entry_date, issue_date, created_at), id`,
      [range.start, range.end]
    );
    const invoiceIds = invoiceRows.map((row) => row.id);
    let itemRows = [];
    if (invoiceIds.length) {
      const placeholders = invoiceIds.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT * FROM fiscal_invoice_items
         WHERE invoice_id IN (${placeholders})
         ORDER BY invoice_id, COALESCE(item_number, id), id`,
        invoiceIds
      );
      itemRows = rows;
    }
    const [stockItems] = await db.query("SELECT * FROM stock_items WHERE status <> 'inativo' ORDER BY name");
    const sped = buildSpedFile(range.start, range.end, invoiceRows, itemRows, stockItems);
    const filename = `sped-fiscal-imec-${range.label}.txt`;
    const [created] = await db.query(
      `INSERT INTO fiscal_sped_exports
       (period_start, period_end, file_name, status, summary, file_content, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [range.start, range.end, filename, 'gerado', JSON.stringify(sped.summary), sped.file_content, req.user.id]
    );
    if (invoiceIds.length) {
      const placeholders = invoiceIds.map(() => '?').join(',');
      await db.query(`UPDATE fiscal_invoices SET sped_status='gerado' WHERE id IN (${placeholders})`, invoiceIds);
    }
    await audit(req.user.id, 'export', 'fiscal_sped', created.insertId, `SPED TXT base ${range.label} gerado`);
    res.json({ success: true, id: created.insertId, period_start: range.start, period_end: range.end, filename, ...sped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar SPED TXT base' });
  }
});

router.get('/sefaz/status', authenticate, authorize(...writeRoles), async (req, res) => {
  const config = sefazConfig();
  const missing = sefazMissing(config);
  let state = null;
  try {
    if (config.cnpj) {
      const [rows] = await db.query('SELECT ult_nsu, max_nsu, last_status, last_message, last_sync_at FROM fiscal_sefaz_state WHERE cnpj=? LIMIT 1', [config.cnpj]);
      state = rows[0] || null;
    }
  } catch (err) {
    state = null;
  }
  res.json({
    ready: missing.length === 0,
    enabled: config.enabled,
    cnpj: config.cnpj ? config.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : null,
    uf: config.uf,
    environment: config.environment,
    ultNSU: state && state.ult_nsu,
    maxNSU: state && state.max_nsu,
    last_status: state && state.last_status,
    last_message: state && state.last_message,
    last_sync_at: state && state.last_sync_at,
    cert_exists: config.cert_exists,
    cert_password_set: config.cert_password_set,
    cert_path_set: Boolean(config.cert_path),
    cert_path: config.cert_path,
    cert_resolved_path: config.cert_resolved_path,
    missing
  });
});

router.post('/sefaz/sync', authenticate, authorize(...writeRoles), async (req, res) => {
  const config = sefazConfig();
  const missing = sefazMissing(config);
  if (missing.length) {
    return res.status(400).json({
      error: 'Configuracao SEFAZ incompleta',
      missing
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const state = await ensureSefazState(conn, config);
    let ultNSU = padNsu((req.body && req.body.ultNSU) || state.ult_nsu);
    let maxNSU = padNsu(state.max_nsu || ultNSU);
    const cycles = Math.min(Math.max(Number((req.body && req.body.cycles) || 1), 1), 5);
    const processed = [];
    const ignored = [];
    let lastStatus = null;
    let lastMessage = null;

    for (let i = 0; i < cycles; i += 1) {
      const responseXml = await postSefaz(config, buildSefazEnvelope(config, ultNSU));
      const parsed = parseSefazResponse(responseXml);
      lastStatus = parsed.cStat;
      lastMessage = parsed.xMotivo;
      ultNSU = parsed.ultNSU || ultNSU;
      maxNSU = parsed.maxNSU || maxNSU;

      for (const doc of parsed.docs) {
        try {
          const cleanXml = stripNs(doc.xml);
          let data = null;
          let status = 'conferencia';
          let source = 'xml-completo';

          if (/<resNFe\b/i.test(cleanXml)) {
            data = parseSefazSummaryXml(doc.xml);
            status = 'pendente';
            source = 'resumo-sefaz';
          } else if (/<procNFe\b/i.test(cleanXml) || /<NFe\b/i.test(cleanXml)) {
            data = parseNfeXml(doc.xml);
          }

          if (!data || (!data.access_key && !data.number)) {
            ignored.push({ nsu: doc.nsu, schema: doc.schema || 'desconhecido' });
            continue;
          }

          data.xml_url = saveSefazXml(doc.xml, doc.nsu, data.access_key);
          const [existing] = data.access_key
            ? await conn.query('SELECT id FROM fiscal_invoices WHERE access_key=? LIMIT 1', [data.access_key])
            : [[]];
          const saveResult = await saveParsedFiscalInvoice(conn, data, {
            status,
            existed: existing.length > 0,
            notes: source === 'resumo-sefaz'
              ? `Resumo importado da SEFAZ pelo NSU ${doc.nsu}. XML completo pode depender de manifestacao do destinatario.`
              : `XML completo importado da SEFAZ pelo NSU ${doc.nsu}.`
          });
          processed.push({
            id: saveResult.invoiceId,
            action: existing.length ? 'updated' : 'created',
            source,
            nsu: doc.nsu,
            access_key: data.access_key,
            number: data.number,
            supplier_name: data.supplier_name,
            total_invoice: data.total_invoice
          });
        } catch (docError) {
          ignored.push({ nsu: doc.nsu, schema: doc.schema || 'desconhecido', error: docError.message });
        }
      }

      if (ultNSU >= maxNSU || parsed.cStat === '137' || !parsed.docs.length) break;
    }

    await conn.query(
      `UPDATE fiscal_sefaz_state
       SET uf=?, ult_nsu=?, max_nsu=?, last_status=?, last_message=?, last_sync_at=NOW()
       WHERE cnpj=?`,
      [String(config.uf).toUpperCase(), ultNSU, maxNSU, lastStatus, lastMessage, config.cnpj]
    );
    await conn.commit();

    await audit(req.user.id, 'sync', 'fiscal_invoice', null, `Consulta SEFAZ: ${processed.length} documento(s) processado(s)`);
    res.json({
      success: true,
      cStat: lastStatus,
      xMotivo: lastMessage,
      ultNSU,
      maxNSU,
      imported: processed.filter((item) => item.action === 'created').length,
      updated: processed.filter((item) => item.action === 'updated').length,
      ignored: ignored.length,
      documents: processed,
      ignored_documents: ignored
    });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(502).json({
      error: 'Erro ao consultar SEFAZ',
      message: error.message || 'Falha na comunicacao com o servico da SEFAZ'
    });
  } finally {
    conn.release();
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
