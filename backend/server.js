require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');
const upload = require('./middleware/upload');
const { importProposals } = require('./services/proposalImporter');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, '../frontend');
const indexFile = path.join(frontendDir, 'index.html');

// Hostinger runs the Node app behind a reverse proxy. Trusting the first proxy
// lets express-rate-limit read the real client IP without raising warnings.
app.set('trust proxy', 1);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection capturada:', err && err.message ? err.message : err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception capturada:', err && err.message ? err.message : err);
});

async function applyCompatibilityMigrations() {
  const statements = [
    'ALTER TABLE employees MODIFY photo_url MEDIUMTEXT',
    'ALTER TABLE equipment MODIFY photo_url MEDIUMTEXT',
    'ALTER TABLE certificates MODIFY pdf_url MEDIUMTEXT',
    'ALTER TABLE certificates MODIFY card_image_url MEDIUMTEXT',
    'ALTER TABLE medical_exams MODIFY pdf_url MEDIUMTEXT',
    'ALTER TABLE epi_records MODIFY attachment_url MEDIUMTEXT',
    'ALTER TABLE equipment_documents MODIFY file_url MEDIUMTEXT',
    'ALTER TABLE technical_documents MODIFY file_url MEDIUMTEXT',
    `CREATE TABLE IF NOT EXISTS technical_proposals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      proposal_number VARCHAR(60) NOT NULL,
      revision VARCHAR(20) DEFAULT 'R00',
      title VARCHAR(255) NOT NULL,
      proposal_type VARCHAR(80) NOT NULL DEFAULT 'locacao_equipamento',
      client_id INT NULL,
      project_id INT NULL,
      contact_name VARCHAR(255),
      contact_area VARCHAR(255),
      location TEXT,
      request_date DATE,
      proposal_date DATE,
      validity_date DATE,
      status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
      scope_summary TEXT,
      technical_scope MEDIUMTEXT,
      equipment_description MEDIUMTEXT,
      contracted_obligations MEDIUMTEXT,
      client_obligations MEDIUMTEXT,
      commercial_terms MEDIUMTEXT,
      payment_terms TEXT,
      delivery_time TEXT,
      warranty_terms TEXT,
      total_value DECIMAL(14,2) NULL,
      currency VARCHAR(10) DEFAULT 'BRL',
      file_url MEDIUMTEXT,
      source_model VARCHAR(120),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS stock_suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      cnpj VARCHAR(30),
      contact_name VARCHAR(255),
      phone VARCHAR(60),
      email VARCHAR(255),
      address TEXT,
      city VARCHAR(120),
      state VARCHAR(40),
      payment_terms TEXT,
      status VARCHAR(40) NOT NULL DEFAULT 'ativo',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS stock_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(120),
      unit VARCHAR(40) DEFAULT 'un',
      sku VARCHAR(80),
      ca_number VARCHAR(80),
      current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
      minimum_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
      average_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
      location VARCHAR(160),
      supplier_id INT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'ativo',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES stock_suppliers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(60) NOT NULL UNIQUE,
      supplier_id INT NULL,
      requester_name VARCHAR(255),
      department VARCHAR(120),
      project_id INT NULL,
      request_date DATE,
      expected_date DATE,
      delivery_date DATE,
      status VARCHAR(40) NOT NULL DEFAULT 'solicitado',
      priority VARCHAR(40) NOT NULL DEFAULT 'normal',
      payment_terms TEXT,
      freight_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
      discount_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      total_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      file_url MEDIUMTEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES stock_suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_order_id INT NOT NULL,
      stock_item_id INT NULL,
      description VARCHAR(255) NOT NULL,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
      unit VARCHAR(40) DEFAULT 'un',
      unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
      total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
      delivered_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS fiscal_invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      access_key VARCHAR(60) UNIQUE,
      model VARCHAR(20) DEFAULT '55',
      series VARCHAR(30),
      number VARCHAR(60),
      issue_date DATE,
      entry_date DATE,
      operation_type VARCHAR(255),
      supplier_id INT NULL,
      supplier_name VARCHAR(255),
      supplier_cnpj VARCHAR(30),
      supplier_ie VARCHAR(60),
      client_name VARCHAR(255),
      client_cnpj VARCHAR(30),
      purchase_order_id INT NULL,
      total_products DECIMAL(14,2) NOT NULL DEFAULT 0,
      total_invoice DECIMAL(14,2) NOT NULL DEFAULT 0,
      freight_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      discount_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      icms_base DECIMAL(14,2) NOT NULL DEFAULT 0,
      icms_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      ipi_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      pis_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      cofins_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      cfop VARCHAR(120),
      entry_cfop VARCHAR(30),
      status VARCHAR(40) NOT NULL DEFAULT 'conferencia',
      financial_status VARCHAR(40) NOT NULL DEFAULT 'nao_lancado',
      stock_status VARCHAR(40) NOT NULL DEFAULT 'nao_lancado',
      fiscal_status VARCHAR(40) NOT NULL DEFAULT 'conferencia',
      payment_due_date DATE,
      finance_payable_id INT NULL,
      sped_status VARCHAR(40) NOT NULL DEFAULT 'pendente',
      xml_url MEDIUMTEXT,
      danfe_url MEDIUMTEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES stock_suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS fiscal_invoice_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      item_number INT,
      product_code VARCHAR(120),
      description VARCHAR(255),
      ncm VARCHAR(30),
      cfop VARCHAR(30),
      unit VARCHAR(30),
      quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
      unit_value DECIMAL(14,4) NOT NULL DEFAULT 0,
      total_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      icms_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      entry_cfop VARCHAR(30),
      tax_status VARCHAR(40) NOT NULL DEFAULT 'conferencia',
      credit_indicator VARCHAR(30) NOT NULL DEFAULT 'analisar',
      icms_credit_base DECIMAL(14,2) NOT NULL DEFAULT 0,
      icms_credit_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      stock_item_id INT NULL,
      stock_movement_id INT NULL,
      fiscal_notes TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES fiscal_invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS finance_payables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NULL,
      supplier_id INT NULL,
      document_number VARCHAR(80),
      description VARCHAR(255),
      issue_date DATE,
      due_date DATE,
      total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'aberto',
      category VARCHAR(80) NOT NULL DEFAULT 'nota_fiscal',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES fiscal_invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (supplier_id) REFERENCES stock_suppliers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stock_item_id INT NOT NULL,
      invoice_id INT NULL,
      invoice_item_id INT NULL,
      movement_type VARCHAR(40) NOT NULL DEFAULT 'entrada_nfe',
      quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
      unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
      total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
      reference VARCHAR(120),
      movement_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES fiscal_invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (invoice_item_id) REFERENCES fiscal_invoice_items(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS fiscal_sped_exports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      file_name VARCHAR(180),
      status VARCHAR(40) NOT NULL DEFAULT 'gerado',
      summary LONGTEXT,
      file_content LONGTEXT,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS fiscal_sefaz_state (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cnpj VARCHAR(20) NOT NULL UNIQUE,
      uf VARCHAR(2) NOT NULL DEFAULT 'SP',
      ult_nsu VARCHAR(20) NOT NULL DEFAULT '000000000000000',
      max_nsu VARCHAR(20),
      last_status VARCHAR(20),
      last_message VARCHAR(255),
      last_sync_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    'ALTER TABLE technical_proposals MODIFY file_url MEDIUMTEXT',
    'ALTER TABLE purchase_orders MODIFY file_url MEDIUMTEXT',
    'ALTER TABLE fiscal_invoices ADD COLUMN entry_cfop VARCHAR(30)',
    "ALTER TABLE fiscal_invoices ADD COLUMN financial_status VARCHAR(40) NOT NULL DEFAULT 'nao_lancado'",
    "ALTER TABLE fiscal_invoices ADD COLUMN stock_status VARCHAR(40) NOT NULL DEFAULT 'nao_lancado'",
    "ALTER TABLE fiscal_invoices ADD COLUMN fiscal_status VARCHAR(40) NOT NULL DEFAULT 'conferencia'",
    'ALTER TABLE fiscal_invoices ADD COLUMN payment_due_date DATE',
    'ALTER TABLE fiscal_invoices ADD COLUMN finance_payable_id INT NULL',
    "ALTER TABLE fiscal_invoices ADD COLUMN sped_status VARCHAR(40) NOT NULL DEFAULT 'pendente'",
    'ALTER TABLE fiscal_invoice_items ADD COLUMN entry_cfop VARCHAR(30)',
    "ALTER TABLE fiscal_invoice_items ADD COLUMN tax_status VARCHAR(40) NOT NULL DEFAULT 'conferencia'",
    "ALTER TABLE fiscal_invoice_items ADD COLUMN credit_indicator VARCHAR(30) NOT NULL DEFAULT 'analisar'",
    'ALTER TABLE fiscal_invoice_items ADD COLUMN icms_credit_base DECIMAL(14,2) NOT NULL DEFAULT 0',
    'ALTER TABLE fiscal_invoice_items ADD COLUMN icms_credit_value DECIMAL(14,2) NOT NULL DEFAULT 0',
    'ALTER TABLE fiscal_invoice_items ADD COLUMN stock_item_id INT NULL',
    'ALTER TABLE fiscal_invoice_items ADD COLUMN stock_movement_id INT NULL',
    'ALTER TABLE fiscal_invoice_items ADD COLUMN fiscal_notes TEXT',
    'CREATE INDEX idx_technical_proposals_client ON technical_proposals(client_id)',
    'CREATE INDEX idx_technical_proposals_status ON technical_proposals(status)',
    'CREATE INDEX idx_technical_proposals_date ON technical_proposals(proposal_date)',
    'ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL',
    'ALTER TABLE system_settings ADD COLUMN notification_email VARCHAR(255)',
    'ALTER TABLE system_settings ADD COLUMN smtp_host VARCHAR(255)',
    'ALTER TABLE system_settings ADD COLUMN smtp_port INT DEFAULT 587',
    'ALTER TABLE system_settings ADD COLUMN smtp_secure BOOLEAN DEFAULT FALSE',
    'ALTER TABLE system_settings ADD COLUMN smtp_user VARCHAR(255)',
    'ALTER TABLE system_settings ADD COLUMN smtp_pass VARCHAR(255)',
    'ALTER TABLE system_settings ADD COLUMN smtp_from VARCHAR(255)',
    'CREATE INDEX idx_certificates_employee ON certificates(employee_id)',
    'CREATE INDEX idx_certificates_training ON certificates(training_id)',
    'CREATE INDEX idx_certificates_expiration ON certificates(expiration_date)',
    'CREATE INDEX idx_medical_exams_employee ON medical_exams(employee_id)',
    'CREATE INDEX idx_medical_exams_expiration ON medical_exams(expiration_date)',
    'CREATE INDEX idx_epi_records_employee ON epi_records(employee_id)',
    'CREATE INDEX idx_equipment_documents_equipment ON equipment_documents(equipment_id)',
    'CREATE INDEX idx_technical_documents_project ON technical_documents(project_id)',
    'CREATE INDEX idx_stock_items_supplier ON stock_items(supplier_id)',
    'CREATE INDEX idx_stock_items_stock ON stock_items(current_stock, minimum_stock)',
    'CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id)',
    'CREATE INDEX idx_purchase_orders_status ON purchase_orders(status)',
    'CREATE INDEX idx_purchase_orders_expected ON purchase_orders(expected_date)',
    'CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(purchase_order_id)',
    'CREATE INDEX idx_fiscal_invoices_issue ON fiscal_invoices(issue_date)',
    'CREATE INDEX idx_fiscal_invoices_supplier ON fiscal_invoices(supplier_id)',
    'CREATE INDEX idx_fiscal_invoices_status ON fiscal_invoices(status)',
    'CREATE INDEX idx_fiscal_invoices_flow ON fiscal_invoices(financial_status, stock_status, fiscal_status)',
    'CREATE INDEX idx_fiscal_invoices_sped ON fiscal_invoices(sped_status, entry_date)',
    'CREATE INDEX idx_fiscal_invoice_items_invoice ON fiscal_invoice_items(invoice_id)',
    'CREATE INDEX idx_fiscal_invoice_items_stock ON fiscal_invoice_items(stock_item_id)',
    'CREATE INDEX idx_fiscal_sefaz_state_cnpj ON fiscal_sefaz_state(cnpj)',
    'CREATE INDEX idx_finance_payables_invoice ON finance_payables(invoice_id)',
    'CREATE INDEX idx_finance_payables_due ON finance_payables(due_date, status)',
    'CREATE INDEX idx_stock_movements_item ON stock_movements(stock_item_id)',
    'CREATE INDEX idx_stock_movements_invoice ON stock_movements(invoice_id)',
    'CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date)',
    'CREATE INDEX idx_fiscal_sped_exports_period ON fiscal_sped_exports(period_start, period_end)'
  ];

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (err) {
      const msg = String(err.message || '');
      if (!msg.includes('Duplicate key name') && !msg.includes('Duplicate column name') && !msg.includes('Duplicate foreign key constraint name') && !msg.includes('check that column/key exists')) {
        console.warn('Compatibilidade do banco nao aplicada:', msg || err.code || 'erro desconhecido');
      }
    }
  }
}

async function importBundledProposalManifest() {
  if (String(process.env.DISABLE_PROPOSAL_MANIFEST_IMPORT || '').toLowerCase() === 'true') return;

  const manifestPath = process.env.PROPOSALS_MANIFEST_PATH || path.join(__dirname, '../database/proposals-import-manifest.json');
  if (!fs.existsSync(manifestPath)) return;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const items = Array.isArray(manifest.items) ? manifest.items : [];
    if (!items.length) return;

    const result = await importProposals(db, {
      items,
      sourceDir: manifest.sourceDir || 'proposals-import-manifest',
      attachFiles: false
    });

    console.log(`Propostas do manifesto: ${result.imported} importadas, ${result.skipped} ja existentes, ${result.failed} falhas.`);
  } catch (err) {
    console.warn('Importacao automatica de propostas ignorada:', err && err.message ? err.message : err);
  }
}

function sendFrontendApp(req, res, next) {
  fs.readFile(indexFile, 'utf8', (err, html) => {
    if (err) return next(err);

    const enhancedHtml = html
      .replace('</head>', '<link rel="stylesheet" href="/pro-dashboard.css">\n<link rel="stylesheet" href="/pro-polish.css">\n</head>')
.replace('</body>', '<script src="/pro-dashboard.js"></script>\n<script src="/pro-polish.js"></script>\n<link rel="stylesheet" href="/nr-idcards.css">\n<script src="/nr-idcards.js"></script>\n<script src="/site-fixes.js"></script>\n<link rel="stylesheet" href="/system-enhancements.css?v=20260803a">\n<script src="/system-enhancements.js?v=20260803a"></script>\n<link rel="stylesheet" href="/production-readiness.css">\n<script src="/production-readiness.js"></script>\n<link rel="stylesheet" href="/executive-control.css">\n<script src="/executive-control.js"></script>\n<link rel="stylesheet" href="/professional-suite.css">\n<script src="/professional-suite.js"></script>\n<link rel="stylesheet" href="/premium-improvements.css">\n<script src="/premium-improvements.js"></script>\n<link rel="stylesheet" href="/epi-control.css?v=20260803a">\n<script src="/epi-control.js?v=20260803a"></script>\n<link rel="stylesheet" href="/home-dashboard.css">\n<script src="/home-dashboard.js"></script>\n<link rel="stylesheet" href="/vehicle-documents.css">\n<script src="/vehicle-documents.js"></script>\n<link rel="stylesheet" href="/proposals-control.css">\n<script src="/proposals-control.js"></script>\n<link rel="stylesheet" href="/warehouse-control.css?v=20260731c">\n<script src="/warehouse-control.js?v=20260731c"></script>\n<link rel="stylesheet" href="/fiscal-control.css?v=20260803h">\n<script src="/fiscal-control.js?v=20260803h"></script>\n<link rel="stylesheet" href="/responsive-hardening.css?v=20260803a">\n</body>');

    res.type('html').send(enhancedHtml);
  });
}

// Security middleware
// This app is an HTML SPA with inline handlers and CDN assets injected in index.html.
// Keep Helmet protections but disable CSP so Tailwind, QRCode and existing inline UI code can run.
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Muitas requisições, tente novamente mais tarde'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('dev'));

// Static files for uploads
app.use('/uploads', express.static(upload.uploadDir || path.join(__dirname, 'uploads')));

// Serve frontend
app.get('/', sendFrontendApp);
app.use(express.static(frontendDir, { index: false }));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/trainings', require('./routes/trainings'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/medical-exams', require('./routes/medicalExams'));
app.use('/api/epi', require('./routes/epi'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/equipment-documents', require('./routes/equipmentDocuments'));
app.use('/api/vehicle-ai', require('./routes/vehicleAi'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/technical-documents', require('./routes/technicalDocuments'));
app.use('/api/technical-proposals', require('./routes/technicalProposals'));
app.use('/api/warehouse', require('./routes/warehouse'));
app.use('/api/fiscal', require('./routes/fiscal'));
app.use('/api/competency', require('./routes/competency'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return sendFrontendApp(req, res, next);
  }
  next();
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

applyCompatibilityMigrations()
  .then(importBundledProposalManifest)
  .catch((err) => {
    console.warn('Migracoes/importacao de compatibilidade ignoradas:', err && err.message ? err.message : err);
  });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`IMEC Compliance Industrial API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

console.log('Upload directory configured:', upload.uploadDir || path.join(__dirname, 'uploads'));

module.exports = app;
