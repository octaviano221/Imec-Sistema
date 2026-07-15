const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const daysUntil = (date, now = new Date()) => Math.ceil((new Date(date) - now) / (1000 * 60 * 60 * 24));
const alertLevel = (days) => (days < 0 ? 'critical' : 'warning');

router.get('/', authenticate, async (req, res) => {
  try {
    const [settings] = await db.query('SELECT expiration_alert_days FROM system_settings LIMIT 1');
    const alertDays = settings[0]?.expiration_alert_days || 30;

    const [activeEmployees] = await db.query("SELECT COUNT(*) as count FROM employees WHERE status = 'ativo'");
    const [totalCertificates] = await db.query('SELECT COUNT(*) as count FROM certificates');
    const [cancelledCertificates] = await db.query("SELECT COUNT(*) as count FROM certificates WHERE status = 'cancelado'");
    const [totalClients] = await db.query('SELECT COUNT(*) as count FROM clients');
    const [totalEquipment] = await db.query('SELECT COUNT(*) as count FROM equipment');
    const [totalCranes] = await db.query("SELECT COUNT(*) as count FROM equipment WHERE LOWER(type) LIKE '%guindaste%' OR LOWER(type) LIKE '%munck%' OR LOWER(type) LIKE '%ponte%'");
    const [activeProjects] = await db.query("SELECT COUNT(*) as count FROM projects WHERE status = 'em_andamento' OR status = 'planejada'");
    const [auditLogs] = await db.query(`
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 20
    `);

    const now = new Date();
    const [allCerts] = await db.query('SELECT status, expiration_date FROM certificates');
    let validCertificates = 0;
    let expiringCertificates = 0;
    let expiredCertificates = 0;

    for (const cert of allCerts) {
      if (cert.status === 'cancelado') continue;
      const days = daysUntil(cert.expiration_date, now);
      if (days < 0) expiredCertificates++;
      else if (days <= alertDays) expiringCertificates++;
      else validCertificates++;
    }

    const [asoResults] = await db.query(`
      SELECT m.id, m.exam_type, m.expiration_date, e.full_name as employee_name
      FROM medical_exams m
      LEFT JOIN employees e ON m.employee_id = e.id
      WHERE m.expiration_date IS NOT NULL
    `);
    const expiredASO = asoResults.filter((aso) => daysUntil(aso.expiration_date, now) < 0).length;

    const [laudoResults] = await db.query(`
      SELECT ed.id, ed.title, ed.document_type, ed.expiration_date, eq.name as equipment_name
      FROM equipment_documents ed
      LEFT JOIN equipment eq ON ed.equipment_id = eq.id
      WHERE expiration_date IS NOT NULL
        AND (LOWER(ed.document_type) LIKE '%laudo%' OR LOWER(ed.title) LIKE '%laudo%')
    `);
    const expiredLaudos = laudoResults.filter((laudo) => daysUntil(laudo.expiration_date, now) < 0).length;

    const alerts = [];

    const [expiringCerts] = await db.query(`
      SELECT c.id, c.certificate_code, c.expiration_date, e.full_name as employee_name, t.name as training_name
      FROM certificates c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN trainings t ON c.training_id = t.id
      WHERE c.status != 'cancelado'
    `);

    for (const cert of expiringCerts) {
      const days = daysUntil(cert.expiration_date, now);
      if (days < 0 || days <= alertDays) {
        alerts.push({
          type: days < 0 ? 'Certificado vencido' : 'Certificado a vencer',
          level: alertLevel(days),
          msg: days < 0
            ? `Certificado ${cert.certificate_code} de ${cert.employee_name} (${cert.training_name}) vencido ha ${Math.abs(days)} dias`
            : `Certificado ${cert.certificate_code} de ${cert.employee_name} (${cert.training_name}) vence em ${days} dias`,
          entity_id: cert.id
        });
      }
    }

    for (const aso of asoResults) {
      const days = daysUntil(aso.expiration_date, now);
      if (days < 0 || days <= alertDays) {
        const owner = aso.employee_name || 'Funcionario nao informado';
        const examType = aso.exam_type || 'ASO';
        alerts.push({
          type: days < 0 ? 'ASO vencido' : 'ASO a vencer',
          level: alertLevel(days),
          msg: days < 0
            ? `${examType} de ${owner} vencido ha ${Math.abs(days)} dias`
            : `${examType} de ${owner} vence em ${days} dias`,
          entity_id: aso.id
        });
      }
    }

    for (const laudo of laudoResults) {
      const days = daysUntil(laudo.expiration_date, now);
      if (days < 0 || days <= alertDays) {
        const title = laudo.title || laudo.document_type || 'Laudo';
        const equipment = laudo.equipment_name || 'equipamento nao informado';
        alerts.push({
          type: days < 0 ? 'Laudo vencido' : 'Laudo a vencer',
          level: alertLevel(days),
          msg: days < 0
            ? `${title} de ${equipment} vencido ha ${Math.abs(days)} dias`
            : `${title} de ${equipment} vence em ${days} dias`,
          entity_id: laudo.id
        });
      }
    }

    const metrics = {
      activeEmployees: activeEmployees[0].count,
      active_employees: activeEmployees[0].count,
      validCertificates,
      valid_certificates: validCertificates,
      expiringCertificates,
      expiring_certificates: expiringCertificates,
      expiredCertificates,
      expired_certificates: expiredCertificates,
      expiredASO,
      expired_aso: expiredASO,
      totalEquipment: totalEquipment[0].count,
      total_equipment: totalEquipment[0].count,
      totalCranes: totalCranes[0].count,
      total_cranes: totalCranes[0].count,
      expiredLaudos,
      expired_laudos: expiredLaudos,
      activeProjects: activeProjects[0].count,
      active_projects: activeProjects[0].count,
      totalCertificates: totalCertificates[0].count,
      total_certificates: totalCertificates[0].count,
      cancelledCertificates: cancelledCertificates[0].count,
      cancelled_certificates: cancelledCertificates[0].count,
      totalClients: totalClients[0].count,
      total_clients: totalClients[0].count,
      audit_logs: auditLogs,
      alerts
    };

    res.json(metrics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
});

module.exports = router;
