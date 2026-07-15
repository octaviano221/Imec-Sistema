const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const defaultCatalog = [
  { id: 'manual-avental', name: 'Avental de raspa', type: 'Protecao corporal', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-botina', name: 'Botina de seguranca', type: 'Calcado', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-capacete', name: 'Capacete', type: 'Protecao da cabeca', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-carneira', name: 'Carneira', type: 'Acessorio', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-cinto', name: 'Cinto de seguranca', type: 'Trabalho em altura', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-creme', name: 'Creme de protecao', type: 'Protecao da pele', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-luva', name: 'Luva de raspa', type: 'Protecao das maos', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-mascara', name: 'Mascara respiratoria', type: 'Protecao respiratoria', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-oculos', name: 'Oculos de protecao', type: 'Protecao ocular', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-protetor-auricular', name: 'Protetor auricular', type: 'Protecao auditiva', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-uniforme', name: 'Uniforme', type: 'Vestimenta', current_stock: 0, minimum_stock: 0, status: 'ativo' },
  { id: 'manual-protetor-facial', name: 'Protetor facial', type: 'Protecao facial', current_stock: 0, minimum_stock: 0, status: 'ativo' }
];

function isMissingSchema(error) {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_CANT_CREATE_TABLE'].includes(error && error.code);
}

router.get('/', authenticate, async (req, res) => {
  try {
    const [epis] = await db.query(`
      SELECT ep.*, e.full_name as employee_name, e.cpf as employee_cpf, e.role_position, e.department,
             cat.name as catalog_name, cat.type as catalog_type, cat.manufacturer,
             cat.ca_validity, cat.equipment_validity, cat.current_stock, cat.minimum_stock
      FROM epi_records ep
      LEFT JOIN employees e ON ep.employee_id = e.id
      LEFT JOIN epi_catalog cat ON ep.epi_catalog_id = cat.id
      ORDER BY ep.delivery_date DESC
    `);
    res.json(epis);
  } catch (error) {
    if (isMissingSchema(error)) {
      try {
        const [epis] = await db.query(`
          SELECT ep.*, e.full_name as employee_name
          FROM epi_records ep
          LEFT JOIN employees e ON ep.employee_id = e.id
          ORDER BY ep.delivery_date DESC
        `);
        return res.json(epis);
      } catch (fallbackError) {
        return res.status(500).json({ error: 'Erro ao buscar EPIs' });
      }
    }
    res.status(500).json({ error: 'Erro ao buscar EPIs' });
  }
});

router.get('/catalog', authenticate, async (req, res) => {
  try {
    const [items] = await db.query('SELECT * FROM epi_catalog ORDER BY name');
    res.json(items);
  } catch (error) {
    if (isMissingSchema(error)) return res.json(defaultCatalog);
    res.status(500).json({ error: 'Erro ao buscar catalogo de EPI' });
  }
});

router.post('/catalog', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, type, ca_number, manufacturer, ca_validity, equipment_validity, current_stock, minimum_stock, notes, status } = req.body;
    const [result] = await db.query(
      `INSERT INTO epi_catalog (name, type, ca_number, manufacturer, ca_validity, equipment_validity, current_stock, minimum_stock, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, type || null, ca_number || null, manufacturer || null, ca_validity || null, equipment_validity || null, current_stock || 0, minimum_stock || 0, notes || null, status || 'ativo']
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar EPI no catalogo' });
  }
});

router.put('/catalog/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, type, ca_number, manufacturer, ca_validity, equipment_validity, current_stock, minimum_stock, notes, status } = req.body;
    await db.query(
      `UPDATE epi_catalog SET name=?, type=?, ca_number=?, manufacturer=?, ca_validity=?, equipment_validity=?, current_stock=?, minimum_stock=?, notes=?, status=? WHERE id=?`,
      [name, type || null, ca_number || null, manufacturer || null, ca_validity || null, equipment_validity || null, current_stock || 0, minimum_stock || 0, notes || null, status || 'ativo', req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar EPI do catalogo' });
  }
});

router.delete('/catalog/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM epi_catalog WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir EPI do catalogo' });
  }
});

router.get('/employee/:id/ficha', authenticate, async (req, res) => {
  try {
    const [[employee]] = await db.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Funcionario nao encontrado' });
    const [records] = await db.query(`
      SELECT ep.*, cat.name as catalog_name, cat.type as catalog_type, cat.ca_validity, cat.equipment_validity,
             cat.manufacturer
      FROM epi_records ep
      LEFT JOIN epi_catalog cat ON ep.epi_catalog_id = cat.id
      WHERE ep.employee_id = ?
      ORDER BY ep.delivery_date DESC, ep.id DESC
    `, [req.params.id]);
    const [[settings]] = await db.query('SELECT * FROM system_settings LIMIT 1');
    res.json({ employee, records, settings: settings || {} });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar ficha de EPI' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [epis] = await db.query(`
      SELECT ep.*, e.full_name as employee_name
      FROM epi_records ep
      LEFT JOIN employees e ON ep.employee_id = e.id
      WHERE ep.id = ?
    `, [req.params.id]);
    if (epis.length === 0) return res.status(404).json({ error: 'EPI nao encontrado' });
    res.json(epis[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar EPI' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { employee_id, epi_catalog_id, epi_name, ca_number, quantity, delivery_date, replacement_date, attachment_url, notes, delivery_signature, delivery_signature_method, responsible_name } = req.body;
    const catalogId = /^\d+$/.test(String(epi_catalog_id || '')) ? epi_catalog_id : null;
    let finalName = epi_name;
    let finalCa = ca_number;
    if (!finalName && epi_catalog_id) {
      const fallback = defaultCatalog.find((item) => String(item.id) === String(epi_catalog_id));
      if (fallback) finalName = fallback.name;
    }
    if (catalogId) {
      const [[catalog]] = await db.query('SELECT * FROM epi_catalog WHERE id = ?', [catalogId]);
      if (catalog) {
        finalName = finalName || catalog.name;
        finalCa = finalCa || catalog.ca_number;
      }
    }
    const [result] = await db.query(
      `INSERT INTO epi_records (employee_id, epi_catalog_id, epi_name, ca_number, quantity, delivery_date, replacement_date, attachment_url, notes, delivery_signature, delivery_signature_method, responsible_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, catalogId, finalName, finalCa || null, quantity || 1, delivery_date, replacement_date || null, attachment_url || null, notes || null, delivery_signature || null, delivery_signature_method || null, responsible_name || null, 'entregue']
    );
    if (catalogId) {
      await db.query('UPDATE epi_catalog SET current_stock = GREATEST(COALESCE(current_stock, 0) - ?, 0) WHERE id = ?', [quantity || 1, catalogId]);
    }
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'epi', result.insertId, `EPI cadastrado para funcionario ${employee_id}`]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (isMissingSchema(error)) {
      try {
        const { employee_id, epi_name, ca_number, quantity, delivery_date, replacement_date, attachment_url, notes } = req.body;
        const fallbackName = epi_name || (defaultCatalog.find((item) => String(item.id) === String(req.body.epi_catalog_id)) || {}).name;
        const [result] = await db.query(
          'INSERT INTO epi_records (employee_id, epi_name, ca_number, quantity, delivery_date, replacement_date, attachment_url, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [employee_id, fallbackName, ca_number, quantity || 1, delivery_date, replacement_date || null, attachment_url || null, notes || null]
        );
        return res.status(201).json({ id: result.insertId });
      } catch (fallbackError) {
        return res.status(500).json({ error: 'Erro ao criar EPI' });
      }
    }
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar EPI' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { employee_id, epi_catalog_id, epi_name, ca_number, quantity, delivery_date, replacement_date, attachment_url, notes, delivery_signature, delivery_signature_method, responsible_name, status } = req.body;
    await db.query(
      `UPDATE epi_records SET employee_id=?, epi_catalog_id=?, epi_name=?, ca_number=?, quantity=?, delivery_date=?, replacement_date=?, attachment_url=?, notes=?, delivery_signature=?, delivery_signature_method=?, responsible_name=?, status=? WHERE id=?`,
      [employee_id, epi_catalog_id || null, epi_name, ca_number || null, quantity || 1, delivery_date, replacement_date || null, attachment_url || null, notes || null, delivery_signature || null, delivery_signature_method || null, responsible_name || null, status || 'entregue', req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'epi', req.params.id, `EPI ${req.params.id} atualizado`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar EPI' });
  }
});

router.put('/:id/return', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { return_date, return_condition, return_signature, return_signature_method, return_notes } = req.body;
    const condition = return_condition || 'Bom';
    const status = condition.toLowerCase().includes('extravi') ? 'extraviado'
      : condition.toLowerCase().includes('danific') ? 'danificado'
      : condition.toLowerCase().includes('substit') ? 'substituido'
      : 'devolvido';
    await db.query(
      `UPDATE epi_records SET return_date=?, return_condition=?, return_signature=?, return_signature_method=?, return_notes=?, status=? WHERE id=?`,
      [return_date, condition, return_signature || null, return_signature_method || null, return_notes || null, status, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar devolucao de EPI' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM epi_records WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'epi', req.params.id, `EPI ${req.params.id} excluido`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir EPI' });
  }
});

module.exports = router;
