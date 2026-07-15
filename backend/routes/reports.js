const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const audit = require('../utils/audit');

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(title, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#0f172a;margin:28px;background:#fff}
    header{border-bottom:3px solid #0b2d5b;padding-bottom:14px;margin-bottom:20px}
    h1{margin:0;color:#0b2d5b;font-size:26px} h2{color:#0b2d5b}
    table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #dbe7f5;padding:8px;text-align:left;font-size:12px}
    th{background:#f8fbff;text-transform:uppercase;color:#475569}
    .meta{color:#64748b;font-size:12px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:54px}
    .sign div{border-top:1px solid #0b2d5b;text-align:center;padding-top:10px;font-size:11px;font-weight:bold;text-transform:uppercase}
    @media print{button{display:none}}
  </style></head><body><button onclick="window.print()">Imprimir / PDF</button><header><h1>${esc(title)}</h1><p class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</p></header>${body}<div class="sign"><div>Assinatura do responsavel</div><div>Assinatura do cliente / auditor</div></div></body></html>`;
}

router.get('/audit/html', authenticate, async (req, res) => {
  try {
    const [employees] = await db.query("SELECT COUNT(*) total FROM employees WHERE status = 'ativo'");
    const [expiredCerts] = await db.query("SELECT COUNT(*) total FROM certificates WHERE status <> 'cancelado' AND expiration_date < CURDATE()");
    const [expiredAsos] = await db.query("SELECT COUNT(*) total FROM medical_exams WHERE expiration_date < CURDATE()");
    const [docsMissing] = await db.query("SELECT COUNT(*) total FROM technical_documents WHERE file_url IS NULL OR file_url = ''");
    const rows = [
      ['Funcionarios ativos', employees[0].total],
      ['NRs vencidas', expiredCerts[0].total],
      ['ASOs vencidos', expiredAsos[0].total],
      ['Documentos sem anexo', docsMissing[0].total]
    ].map((row) => `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td></tr>`).join('');
    await audit(req.user.id, 'print', 'report', null, 'Relatorio de auditoria gerado');
    res.type('html').send(shell('Relatorio de Auditoria IMEC', `<table><thead><tr><th>Indicador</th><th>Resultado</th></tr></thead><tbody>${rows}</tbody></table>`));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar relatorio' });
  }
});

router.get('/employee/:id/html', authenticate, async (req, res) => {
  try {
    const [[employee]] = await db.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Funcionario nao encontrado' });
    const [certs] = await db.query(`
      SELECT c.*, t.name training_name, t.code training_code
      FROM certificates c LEFT JOIN trainings t ON t.id = c.training_id
      WHERE c.employee_id = ? ORDER BY c.expiration_date DESC
    `, [req.params.id]);
    const [asos] = await db.query('SELECT * FROM medical_exams WHERE employee_id = ? ORDER BY expiration_date DESC', [req.params.id]);
    const rows = certs.map((c) => `<tr><td>${esc(c.training_code || '')}</td><td>${esc(c.training_name || '')}</td><td>${new Date(c.issue_date).toLocaleDateString('pt-BR')}</td><td>${new Date(c.expiration_date).toLocaleDateString('pt-BR')}</td></tr>`).join('');
    const asoRows = asos.map((a) => `<tr><td>${esc(a.exam_type || 'ASO')}</td><td>${new Date(a.issue_date).toLocaleDateString('pt-BR')}</td><td>${new Date(a.expiration_date).toLocaleDateString('pt-BR')}</td><td>${esc(a.aptitude_result || '')}</td></tr>`).join('');
    await audit(req.user.id, 'print', 'employee', req.params.id, `Dossie de ${employee.full_name} gerado`);
    res.type('html').send(shell(`Dossie do Colaborador - ${employee.full_name}`, `<h2>Dados</h2><p><b>CPF:</b> ${esc(employee.cpf || '-')}<br><b>Funcao:</b> ${esc(employee.role_position || '-')}<br><b>Setor:</b> ${esc(employee.department || '-')}</p><h2>Certificados</h2><table><thead><tr><th>Codigo</th><th>Treinamento</th><th>Emissao</th><th>Validade</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nenhum certificado</td></tr>'}</tbody></table><h2>ASO</h2><table><thead><tr><th>Tipo</th><th>Emissao</th><th>Validade</th><th>Resultado</th></tr></thead><tbody>${asoRows || '<tr><td colspan="4">Nenhum ASO</td></tr>'}</tbody></table>`));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar dossie' });
  }
});

module.exports = router;
