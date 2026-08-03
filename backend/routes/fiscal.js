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

function formatDateTime(value) {
  if (!value) return '-';
  const text = String(value).trim();
  const date = normalizeDate(text);
  const time = (text.match(/T(\d{2}:\d{2}:\d{2})/) || text.match(/\s(\d{2}:\d{2}:\d{2})/) || [])[1];
  return date ? `${formatDate(date)}${time ? ' ' + time : ''}` : text;
}

function formatCep(value) {
  const d = digits(value);
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, '$1-$2') : (value || '-');
}

function fiscalParty(block) {
  const address = firstBlock(block, 'enderEmit') || firstBlock(block, 'enderDest');
  const street = [firstTag(address, 'xLgr'), firstTag(address, 'nro')].filter(Boolean).join(', ');
  const city = [firstTag(address, 'xMun'), firstTag(address, 'UF')].filter(Boolean).join(' - ');
  return {
    name: firstTag(block, 'xNome'),
    doc: digits(firstTag(block, 'CNPJ') || firstTag(block, 'CPF')),
    ie: firstTag(block, 'IE'),
    phone: firstTag(address, 'fone'),
    address: [
      street,
      firstTag(address, 'xBairro'),
      city,
      formatCep(firstTag(address, 'CEP'))
    ].filter((item) => item && item !== '-').join(' | ')
  };
}

function fiscalXmlExtras(invoice) {
  const xmlPath = resolveFiscalXmlPath(invoice && invoice.xml_url);
  if (!xmlPath) return {};
  try {
    const raw = fs.readFileSync(xmlPath, 'utf8');
    const xml = stripNs(raw);
    const emit = fiscalParty(firstBlock(xml, 'emit'));
    const dest = fiscalParty(firstBlock(xml, 'dest'));
    const total = firstBlock(firstBlock(xml, 'total'), 'ICMSTot') || firstBlock(xml, 'ICMSTot');
    const infProt = firstBlock(xml, 'infProt');
    return {
      emit,
      dest,
      protocol: firstTag(infProt, 'nProt'),
      auth_date: firstTag(infProt, 'dhRecbto'),
      status_code: firstTag(infProt, 'cStat'),
      status_reason: firstTag(infProt, 'xMotivo'),
      tp_nf: firstTag(xml, 'tpNF'),
      state_tax_subst_base: num(firstTag(total, 'vBCST')),
      state_tax_subst: num(firstTag(total, 'vST')),
      insurance_value: num(firstTag(total, 'vSeg')),
      other_value: num(firstTag(total, 'vOutro')),
      import_tax: num(firstTag(total, 'vII'))
    };
  } catch (err) {
    return {};
  }
}

function drawBarcode(doc, value, x, y, w, h) {
  const key = digits(value);
  if (!key) {
    doc.rect(x, y, w, h).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.fillColor('#64748b').font('Helvetica').fontSize(6).text('Chave nao informada', x, y + h / 2 - 3, { width: w, align: 'center' });
    return;
  }
  doc.save();
  doc.rect(x, y, w, h).fill('#ffffff');
  let cursor = x + 2;
  for (let i = 0; i < key.length && cursor < x + w - 2; i += 1) {
    const n = Number(key[i]);
    const bar = 0.8 + (n % 4) * 0.45;
    const gap = 0.7 + (n % 3) * 0.28;
    doc.rect(cursor, y + 2, bar, h - 4).fill('#111827');
    cursor += bar + gap;
  }
  doc.restore();
  doc.rect(x, y, w, h).strokeColor('#334155').lineWidth(0.4).stroke();
}

function drawDanfeCell(doc, x, y, w, h, title, value, opts = {}) {
  doc.rect(x, y, w, h).strokeColor('#1f2937').lineWidth(0.35).stroke();
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(5.8).text(String(title || '').toUpperCase(), x + 3, y + 3, { width: w - 6 });
  doc.fillColor('#111827').font(opts.bold === false ? 'Helvetica' : 'Helvetica-Bold').fontSize(opts.size || 7.2)
    .text(String(value || '-'), x + 3, y + 13, { width: w - 6, height: h - 16 });
}

function drawTableHeader(doc, y) {
  const cols = [
    [24, 24, 'ITEM'],
    [48, 60, 'COD. PROD.'],
    [108, 164, 'DESCRICAO DO PRODUTO / SERVICO'],
    [272, 44, 'NCM/SH'],
    [316, 34, 'CFOP'],
    [350, 26, 'UN'],
    [376, 44, 'QTD'],
    [420, 54, 'V. UNIT.'],
    [474, 54, 'V. TOTAL'],
    [528, 44, 'V. ICMS']
  ];
  doc.rect(24, y, 548, 21).fill('#eef4fb');
  doc.fillColor('#263b58').font('Helvetica-Bold').fontSize(6.5);
  cols.forEach(([x, w, label]) => doc.text(label, x + 3, y + 4, { width: w - 6, align: x >= 376 ? 'right' : 'left' }));
  doc.strokeColor('#1f2937').lineWidth(0.35).rect(24, y, 548, 21).stroke();
}

function drawFiscalDanfe(doc, invoice, items) {
  const pageBottom = 802;
  const supplier = shortText(invoice.linked_supplier_name || invoice.supplier_name);
  const fileNumber = shortText(invoice.number, String(invoice.id));
  const accessKey = digits(invoice.access_key);
  const extras = fiscalXmlExtras(invoice);
  const emit = extras.emit || {};
  const dest = extras.dest || {};
  const isFullXml = Boolean(items && items.length) || Boolean(extras.protocol);
  const emitName = shortText(emit.name || supplier);
  const destName = shortText(dest.name || invoice.client_name, 'IMEC INDUSTRIA DE BASE METALURGICA EIRELI');
  const destDoc = dest.doc || invoice.client_cnpj;
  const serieModel = 'Serie ' + shortText(invoice.series) + ' | Modelo ' + shortText(invoice.model, '55');
  const operationKind = extras.tp_nf === '1' ? 'SAIDA' : 'ENTRADA';

  doc.rect(20, 20, 555, 804).strokeColor('#111827').lineWidth(0.8).stroke();
  doc.rect(20, 20, 555, 70).fillAndStroke('#f8fafc', '#111827');
  doc.fillColor('#0b2344').font('Helvetica-Bold').fontSize(11).text(emitName, 30, 32, { width: 185 });
  doc.font('Helvetica').fontSize(6.8).fillColor('#334155')
    .text((emit.address || 'Endereco do emitente no XML') + '\nCNPJ/CPF ' + formatDocument(emit.doc || invoice.supplier_cnpj) + '  IE ' + shortText(emit.ie || invoice.supplier_ie), 30, 48, { width: 185, height: 34 });

  doc.rect(220, 20, 134, 70).strokeColor('#111827').lineWidth(0.5).stroke();
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(17).text('DANFE', 220, 28, { width: 134, align: 'center' });
  doc.font('Helvetica').fontSize(6.8).text('Documento Auxiliar da Nota Fiscal Eletronica', 226, 49, { width: 122, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(8).text(operationKind, 226, 66, { width: 122, align: 'center' });
  doc.font('Helvetica').fontSize(7).text('NF-e ' + fileNumber + '  ' + serieModel, 226, 78, { width: 122, align: 'center' });

  doc.rect(354, 20, 221, 70).strokeColor('#111827').lineWidth(0.5).stroke();
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(6).text('CHAVE DE ACESSO', 364, 28);
  drawBarcode(doc, accessKey, 364, 39, 195, 22);
  doc.fillColor('#111827').font('Courier-Bold').fontSize(7.5).text(accessKey || 'Chave nao informada', 364, 64, { width: 195, align: 'center' });
  doc.fillColor('#475569').font('Helvetica').fontSize(5.7).text('Consulta de autenticidade no portal nacional da NF-e.', 364, 78, { width: 195, align: 'center' });

  let y = 90;
  drawDanfeCell(doc, 20, y, 278, 28, 'Natureza da operacao', shortText(invoice.operation_type), { size: 7 });
  drawDanfeCell(doc, 298, y, 277, 28, 'Protocolo de autorizacao de uso', extras.protocol ? `${extras.protocol} - ${formatDateTime(extras.auth_date)}` : (isFullXml ? 'Autorizacao nao localizada no XML' : 'Resumo SEFAZ - XML completo ainda nao disponivel'), { size: 7 });
  y += 28;

  doc.rect(20, y, 555, 14).fillAndStroke('#eef4fb', '#111827');
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text('DESTINATARIO / REMETENTE', 26, y + 4);
  y += 14;
  drawDanfeCell(doc, 20, y, 266, 31, 'Nome / Razao social', destName, { size: 7 });
  drawDanfeCell(doc, 286, y, 130, 31, 'CNPJ / CPF', formatDocument(destDoc), { size: 7 });
  drawDanfeCell(doc, 416, y, 74, 31, 'Data emissao', formatDate(invoice.issue_date), { size: 7 });
  drawDanfeCell(doc, 490, y, 85, 31, 'Data entrada/saida', formatDate(invoice.entry_date), { size: 7 });
  y += 31;
  drawDanfeCell(doc, 20, y, 396, 31, 'Endereco', shortText(dest.address, 'Endereco nao informado'), { size: 6.7, bold: false });
  drawDanfeCell(doc, 416, y, 74, 31, 'Inscricao estadual', shortText(dest.ie), { size: 7 });
  drawDanfeCell(doc, 490, y, 85, 31, 'Telefone', shortText(dest.phone), { size: 7 });
  y += 39;

  doc.rect(20, y, 555, 14).fillAndStroke('#eef4fb', '#111827');
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text('CALCULO DO IMPOSTO', 26, y + 4);
  y += 14;
  drawDanfeCell(doc, 20, y, 82, 30, 'Base ICMS', formatMoney(invoice.icms_base), { size: 7 });
  drawDanfeCell(doc, 102, y, 82, 30, 'Valor ICMS', formatMoney(invoice.icms_value), { size: 7 });
  drawDanfeCell(doc, 184, y, 82, 30, 'Base ICMS ST', formatMoney(extras.state_tax_subst_base), { size: 7 });
  drawDanfeCell(doc, 266, y, 82, 30, 'Valor ICMS ST', formatMoney(extras.state_tax_subst), { size: 7 });
  drawDanfeCell(doc, 348, y, 76, 30, 'Valor IPI', formatMoney(invoice.ipi_value), { size: 7 });
  drawDanfeCell(doc, 424, y, 75, 30, 'Valor produtos', formatMoney(invoice.total_products), { size: 7 });
  drawDanfeCell(doc, 499, y, 76, 30, 'Valor NF-e', formatMoney(invoice.total_invoice), { size: 7.6 });
  y += 30;
  drawDanfeCell(doc, 20, y, 82, 30, 'Frete', formatMoney(invoice.freight_value), { size: 7 });
  drawDanfeCell(doc, 102, y, 82, 30, 'Seguro', formatMoney(extras.insurance_value), { size: 7 });
  drawDanfeCell(doc, 184, y, 82, 30, 'Desconto', formatMoney(invoice.discount_value), { size: 7 });
  drawDanfeCell(doc, 266, y, 82, 30, 'Outras despesas', formatMoney(extras.other_value), { size: 7 });
  drawDanfeCell(doc, 348, y, 76, 30, 'II', formatMoney(extras.import_tax), { size: 7 });
  drawDanfeCell(doc, 424, y, 75, 30, 'PIS', formatMoney(invoice.pis_value), { size: 7 });
  drawDanfeCell(doc, 499, y, 76, 30, 'COFINS', formatMoney(invoice.cofins_value), { size: 7 });
  y += 38;

  doc.rect(20, y, 555, 14).fillAndStroke('#eef4fb', '#111827');
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text('DADOS DOS PRODUTOS / SERVICOS', 26, y + 4);
  y += 14;
  drawTableHeader(doc, y);
  y += 21;

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
    const rowHeight = Math.max(24, doc.heightOfString(desc, { width: 158 }) + 12);
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      doc.rect(20, 20, 555, 804).strokeColor('#111827').lineWidth(0.8).stroke();
      y = 36;
      drawTableHeader(doc, y);
      y += 21;
    }
    doc.strokeColor('#1f2937').lineWidth(0.25).rect(24, y, 548, rowHeight).stroke();
    doc.fillColor('#111827').font('Helvetica').fontSize(6.5);
    doc.text(String(item.item_number || '-'), 27, y + 7, { width: 18 });
    doc.text(shortText(item.product_code), 51, y + 7, { width: 54 });
    doc.text(desc, 111, y + 7, { width: 158, height: rowHeight - 9 });
    doc.text(shortText(item.ncm), 275, y + 7, { width: 38 });
    doc.text(shortText(item.cfop), 319, y + 7, { width: 28 });
    doc.text(shortText(item.unit), 353, y + 7, { width: 20, align: 'right' });
    doc.text(String(num(item.quantity) || '-'), 379, y + 7, { width: 38, align: 'right' });
    doc.text(formatMoney(item.unit_value), 423, y + 7, { width: 48, align: 'right' });
    doc.font('Helvetica-Bold').text(formatMoney(item.total_value), 477, y + 7, { width: 48, align: 'right' });
    doc.font('Helvetica').text(formatMoney(item.icms_value || 0), 531, y + 7, { width: 38, align: 'right' });
    y += rowHeight;
  });

  y += 10;
  if (y + 98 > pageBottom) {
    doc.addPage();
    doc.rect(20, 20, 555, 804).strokeColor('#111827').lineWidth(0.8).stroke();
    y = 36;
  }
  doc.rect(20, y, 555, 58).strokeColor('#111827').lineWidth(0.35).stroke();
  doc.fillColor('#0b2344').font('Helvetica-Bold').fontSize(8).text('INFORMACOES COMPLEMENTARES', 28, y + 8);
  const notes = isFullXml
    ? shortText(invoice.notes, 'XML oficial armazenado no sistema. Baixe o XML para guardar o documento fiscal eletronico.')
    : 'Esta nota foi recebida como resumo da SEFAZ. Para ter a NF-e completa, mantenha o XML oficial baixado pelo robo fiscal ou importe o XML completo.';
  doc.fillColor('#334155').font('Helvetica').fontSize(7).text(notes, 28, y + 22, { width: 520, height: 28 });
  y += 68;
  doc.fillColor('#64748b').font('Helvetica').fontSize(6.5)
    .text('DANFE gerado pelo IMEC Compliance para conferencia. O documento fiscal eletronico valido e o arquivo XML autorizado pela SEFAZ.', 20, y, { width: 555, align: 'center' });
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
        conference_total: pending.concat(divergent).reduce((sum, invoice) => sum + num(invoice.total_invoice), 0)
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
