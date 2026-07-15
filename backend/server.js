require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, '../frontend');
const indexFile = path.join(frontendDir, 'index.html');

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
    'CREATE INDEX idx_technical_documents_project ON technical_documents(project_id)'
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

function sendFrontendApp(req, res, next) {
  fs.readFile(indexFile, 'utf8', (err, html) => {
    if (err) return next(err);

    const enhancedHtml = html
      .replace('</head>', '<link rel="stylesheet" href="/pro-dashboard.css">\n<link rel="stylesheet" href="/pro-polish.css">\n</head>')
      .replace('</body>', '<script src="/pro-dashboard.js"></script>\n<script src="/pro-polish.js"></script>\n<link rel="stylesheet" href="/nr-idcards.css">\n<script src="/nr-idcards.js"></script>\n<script src="/site-fixes.js"></script>\n<link rel="stylesheet" href="/system-enhancements.css">\n<script src="/system-enhancements.js"></script>\n<link rel="stylesheet" href="/production-readiness.css">\n<script src="/production-readiness.js"></script>\n<link rel="stylesheet" href="/executive-control.css">\n<script src="/executive-control.js"></script>\n<link rel="stylesheet" href="/professional-suite.css">\n<script src="/professional-suite.js"></script>\n<link rel="stylesheet" href="/premium-improvements.css">\n<script src="/premium-improvements.js"></script>\n<link rel="stylesheet" href="/epi-control.css">\n<script src="/epi-control.js"></script>\n</body>');

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/technical-documents', require('./routes/technicalDocuments'));
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

applyCompatibilityMigrations().catch((err) => {
  console.warn('Migracoes de compatibilidade ignoradas:', err && err.message ? err.message : err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 IMEC Compliance Industrial API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
