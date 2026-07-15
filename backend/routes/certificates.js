const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');

// GET all certificates
router.get('/', authenticate, async (req, res) => {
  try {
    const [certs] = await db.query(`
      SELECT c.*, e.full_name as employee_name, t.name as training_name, t.code as training_code
      FROM certificates c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN trainings t ON c.training_id = t.id
      ORDER BY c.created_at DESC
    `);
    res.json(certs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar certificados' });
  }
});

// GET single certificate
// Restrict to numeric IDs so public /verify/:token and /consult/:code stay public.
router.get('/:id(\\d+)', authenticate, async (req, res) => {
  try {
    const [certs] = await db.query(`
      SELECT c.*, e.full_name as employee_name, t.name as training_name, t.code as training_code
      FROM certificates c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN trainings t ON c.training_id = t.id
      WHERE c.id = ?
    `, [req.params.id]);
    if (certs.length === 0) return res.status(404).json({ error: 'Certificado não encontrado' });
    res.json(certs[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar certificado' });
  }
});

// PUBLIC: Verify certificate by token
router.get('/verify/:token', async (req, res) => {
  try {
    const [certs] = await db.query(`
      SELECT c.*, e.full_name as employee_name, e.cpf as employee_cpf,
             t.name as training_name, t.code as training_code
      FROM certificates c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN trainings t ON c.training_id = t.id
      WHERE c.verification_token = ?
    `, [req.params.token]);
    
    if (certs.length === 0) {
      return res.json({ found: false, message: 'Certificado não encontrado' });
    }
    
    const cert = certs[0];
    const [settings] = await db.query('SELECT expiration_alert_days FROM system_settings LIMIT 1');
    const alertDays = settings[0]?.expiration_alert_days || 30;
    
    const now = new Date();
    const expDate = new Date(cert.expiration_date);
    const daysUntil = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    
    let status = cert.status === 'cancelado' ? 'cancelado' : 
                 daysUntil < 0 ? 'vencido' : 
                 daysUntil <= alertDays ? 'vencendo' : 'valido';
    
    res.json({
      found: true,
      certificate: {
        ...cert,
        calculated_status: status,
        days_until_expiration: daysUntil,
        employee_cpf_masked: cert.employee_cpf ? '***.***.***-' + cert.employee_cpf.slice(-2) : null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao verificar certificado' });
  }
});

// PUBLIC: Consult certificate by code
router.get('/consult/:code', async (req, res) => {
  try {
    const [certs] = await db.query(`
      SELECT c.*, e.full_name as employee_name, e.cpf as employee_cpf,
             t.name as training_name, t.code as training_code
      FROM certificates c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN trainings t ON c.training_id = t.id
      WHERE c.certificate_code = ?
    `, [req.params.code]);
    
    if (certs.length === 0) {
      return res.json({ found: false, message: 'Certificado não encontrado' });
    }
    
    const cert = certs[0];
    const [settings] = await db.query('SELECT expiration_alert_days FROM system_settings LIMIT 1');
    const alertDays = settings[0]?.expiration_alert_days || 30;
    
    const now = new Date();
    const expDate = new Date(cert.expiration_date);
    const daysUntil = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    
    let status = cert.status === 'cancelado' ? 'cancelado' : 
                 daysUntil < 0 ? 'vencido' : 
                 daysUntil <= alertDays ? 'vencendo' : 'valido';
    
    res.json({
      found: true,
      certificate: {
        ...cert,
        calculated_status: status,
        days_until_expiration: daysUntil,
        employee_cpf_masked: cert.employee_cpf ? '***.***.***-' + cert.employee_cpf.slice(-2) : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar certificado' });
  }
});

// POST create certificate
router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { employee_id, training_id, issue_date, expiration_date, workload, instructor_name, issuer_company, technical_responsible, crea_number, pdf_url, card_image_url, notes } = req.body;
    
    const [training] = await db.query('SELECT code FROM trainings WHERE id = ?', [training_id]);
    const trainCode = training[0]?.code || 'CERT';
    
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM certificates');
    const certNumber = String(countResult[0].total + 1).padStart(6, '0');
    const year = new Date().getFullYear();
    
    const certificate_code = `IMEC-${trainCode}-${year}-${certNumber}`;
    const verification_token = crypto.randomBytes(32).toString('hex');
    
    const [result] = await db.query(
      `INSERT INTO certificates (employee_id, training_id, certificate_code, verification_token, issue_date, expiration_date, workload, instructor_name, issuer_company, technical_responsible, crea_number, pdf_url, card_image_url, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, training_id, certificate_code, verification_token, issue_date, expiration_date, workload, instructor_name, issuer_company, technical_responsible, crea_number, pdf_url, card_image_url, notes, req.user.id]
    );
    
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'certificate', result.insertId, `Certificado ${certificate_code} criado`]);
    
    res.status(201).json({ id: result.insertId, certificate_code, verification_token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar certificado' });
  }
});

// PUT update certificate
router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { employee_id, training_id, issue_date, expiration_date, workload, instructor_name, issuer_company, technical_responsible, crea_number, pdf_url, card_image_url, notes } = req.body;
    await db.query(
      `UPDATE certificates SET employee_id=?, training_id=?, issue_date=?, expiration_date=?, workload=?, instructor_name=?, issuer_company=?, technical_responsible=?, crea_number=?, pdf_url=?, card_image_url=?, notes=? WHERE id=?`,
      [employee_id, training_id, issue_date, expiration_date, workload, instructor_name, issuer_company, technical_responsible, crea_number, pdf_url, card_image_url, notes, req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'certificate', req.params.id, 'Certificado atualizado']);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar certificado' });
  }
});

// POST cancel certificate
router.post('/:id/cancel', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('UPDATE certificates SET status = ? WHERE id = ?', ['cancelado', req.params.id]);
    const [cert] = await db.query('SELECT certificate_code FROM certificates WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'cancel', 'certificate', req.params.id, `Certificado ${cert[0]?.certificate_code} cancelado`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar certificado' });
  }
});

// DELETE certificate
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM certificates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir certificado' });
  }
});

module.exports = router;
