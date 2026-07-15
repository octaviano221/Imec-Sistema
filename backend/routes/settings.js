const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../utils/audit');

router.get('/', authenticate, async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM system_settings LIMIT 1');
    if (settings.length === 0) {
      return res.json({ expiration_alert_days: 30, company_name: '', cnpj: '' });
    }
    res.json(settings[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configuracoes' });
  }
});

router.put('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const payload = req.body;
    const values = [
      payload.company_name,
      payload.cnpj,
      payload.logo_url,
      payload.address,
      payload.email,
      payload.phone,
      payload.technical_responsible,
      payload.crea_number,
      payload.signature_url,
      payload.expiration_alert_days || 30,
      payload.allow_public_pdf_view !== false,
      payload.report_footer,
      payload.notification_email,
      payload.smtp_host,
      payload.smtp_port || 587,
      payload.smtp_secure ? 1 : 0,
      payload.smtp_user,
      payload.smtp_pass,
      payload.smtp_from
    ];

    const [existing] = await db.query('SELECT id FROM system_settings LIMIT 1');
    if (existing.length > 0) {
      await db.query(
        `UPDATE system_settings
         SET company_name=?, cnpj=?, logo_url=?, address=?, email=?, phone=?,
             technical_responsible=?, crea_number=?, signature_url=?, expiration_alert_days=?,
             allow_public_pdf_view=?, report_footer=?, notification_email=?, smtp_host=?,
             smtp_port=?, smtp_secure=?, smtp_user=?, smtp_pass=?, smtp_from=?
         WHERE id=?`,
        [...values, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO system_settings
          (company_name, cnpj, logo_url, address, email, phone, technical_responsible,
           crea_number, signature_url, expiration_alert_days, allow_public_pdf_view,
           report_footer, notification_email, smtp_host, smtp_port, smtp_secure,
           smtp_user, smtp_pass, smtp_from)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
      );
    }

    await audit(req.user.id, 'update', 'settings', 1, 'Configuracoes do sistema atualizadas');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configuracoes' });
  }
});

module.exports = router;
