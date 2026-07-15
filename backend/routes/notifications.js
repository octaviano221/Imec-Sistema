const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../utils/audit');

function daysUntil(dateValue) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - now) / 86400000);
}

async function pendingItems() {
  const [certs] = await db.query(`
    SELECT 'NR' AS type, c.certificate_code AS code, c.expiration_date AS due_date,
           e.full_name AS owner, t.name AS title
    FROM certificates c
    LEFT JOIN employees e ON e.id = c.employee_id
    LEFT JOIN trainings t ON t.id = c.training_id
    WHERE c.status <> 'cancelado' AND c.expiration_date IS NOT NULL
  `);
  const [asos] = await db.query(`
    SELECT 'ASO' AS type, m.exam_type AS code, m.expiration_date AS due_date,
           e.full_name AS owner, m.exam_type AS title
    FROM medical_exams m
    LEFT JOIN employees e ON e.id = m.employee_id
    WHERE m.expiration_date IS NOT NULL
  `);
  const [docs] = await db.query(`
    SELECT 'DOC' AS type, td.document_number AS code, td.expiration_date AS due_date,
           p.name AS owner, COALESCE(td.title, td.document_type) AS title
    FROM technical_documents td
    LEFT JOIN projects p ON p.id = td.project_id
    WHERE td.expiration_date IS NOT NULL
  `);
  const [epis] = await db.query(`
    SELECT 'EPI' AS type, epi.ca_number AS code, epi.replacement_date AS due_date,
           e.full_name AS owner, epi.epi_name AS title
    FROM epi_records epi
    LEFT JOIN employees e ON e.id = epi.employee_id
    WHERE epi.replacement_date IS NOT NULL
  `);

  return certs.concat(asos, docs, epis)
    .map((item) => ({ ...item, days: daysUntil(item.due_date) }))
    .filter((item) => item.days <= 30)
    .sort((a, b) => a.days - b.days);
}

function buildEmailHtml(items) {
  const rows = items.map((item) => `
    <tr>
      <td>${item.type}</td>
      <td>${item.title || '-'}</td>
      <td>${item.owner || '-'}</td>
      <td>${new Date(item.due_date).toLocaleDateString('pt-BR')}</td>
      <td>${item.days < 0 ? `${Math.abs(item.days)} dia(s) vencido` : `${item.days} dia(s)`}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a">
      <h2>IMEC Compliance - Pendencias de conformidade</h2>
      <p>Segue resumo automatico de itens vencidos ou proximos do vencimento.</p>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;border-color:#dbe7f5">
        <thead style="background:#f8fbff"><tr><th>Tipo</th><th>Item</th><th>Responsavel</th><th>Validade</th><th>Prazo</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Nenhuma pendencia encontrada.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

router.get('/pending', authenticate, async (req, res) => {
  try {
    res.json(await pendingItems());
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar pendencias de notificacao' });
  }
});

router.post('/send-test', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [settingsRows] = await db.query('SELECT * FROM system_settings LIMIT 1');
    const settings = settingsRows[0] || {};
    const to = req.body.to || settings.notification_email || settings.email;
    const items = await pendingItems();
    const html = buildEmailHtml(items);

    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass || !to) {
      await audit(req.user.id, 'preview', 'notification', null, 'Previa de notificacao gerada sem SMTP configurado');
      return res.json({
        sent: false,
        preview: true,
        message: 'SMTP nao configurado. Previa gerada para conferencia.',
        to: to || null,
        total: items.length,
        html
      });
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: Number(settings.smtp_port || 587),
      secure: String(settings.smtp_secure) === '1' || settings.smtp_secure === true,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass }
    });

    await transporter.sendMail({
      from: settings.smtp_from || settings.smtp_user,
      to,
      subject: 'IMEC Compliance - Pendencias de conformidade',
      html
    });

    await audit(req.user.id, 'send', 'notification', null, `Notificacao enviada para ${to}`);
    res.json({ sent: true, to, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao enviar notificacao', message: error.message });
  }
});

module.exports = router;
