const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const normalizeRequirement = (item) => ({
  ...item,
  required_training_ids: typeof item.required_training_ids === 'string'
    ? JSON.parse(item.required_training_ids || '[]')
    : (item.required_training_ids || [])
});

router.get('/', authenticate, async (req, res) => {
  try {
    const [items] = await db.query('SELECT * FROM competency_requirements ORDER BY activity_name');
    res.json(items.map(normalizeRequirement));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar requisitos de competencia' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [items] = await db.query('SELECT * FROM competency_requirements WHERE id = ?', [req.params.id]);
    if (items.length === 0) return res.status(404).json({ error: 'Requisito de competencia nao encontrado' });
    res.json(normalizeRequirement(items[0]));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar requisito de competencia' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { activity_name, required_training_ids, requires_aso, requires_epi, requires_client_integration, notes } = req.body;
    const [result] = await db.query(
      'INSERT INTO competency_requirements (activity_name, required_training_ids, requires_aso, requires_epi, requires_client_integration, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [activity_name, JSON.stringify(required_training_ids || []), !!requires_aso, !!requires_epi, !!requires_client_integration, notes || null]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'competency', result.insertId, `Requisito de competencia ${activity_name} cadastrado`]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar requisito de competencia' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { activity_name, required_training_ids, requires_aso, requires_epi, requires_client_integration, notes } = req.body;
    await db.query(
      'UPDATE competency_requirements SET activity_name=?, required_training_ids=?, requires_aso=?, requires_epi=?, requires_client_integration=?, notes=? WHERE id=?',
      [activity_name, JSON.stringify(required_training_ids || []), !!requires_aso, !!requires_epi, !!requires_client_integration, notes || null, req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'competency', req.params.id, `Requisito de competencia ${activity_name} atualizado`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar requisito de competencia' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [item] = await db.query('SELECT activity_name FROM competency_requirements WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM competency_requirements WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'competency', req.params.id, `Requisito de competencia ${item[0]?.activity_name} excluido`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir requisito de competencia' });
  }
});

module.exports = router;
