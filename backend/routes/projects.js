const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [projects] = await db.query(`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar projetos' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [projects] = await db.query(`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (projects.length === 0) return res.status(404).json({ error: 'Projeto nao encontrado' });
    res.json(projects[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar projeto' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { client_id, name, location, start_date, expected_end_date, status, service_description, technical_responsible, notes } = req.body;
    const [result] = await db.query(
      'INSERT INTO projects (client_id, name, location, start_date, expected_end_date, status, service_description, technical_responsible, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [client_id || null, name, location, start_date || null, expected_end_date || null, status || 'planejada', service_description, technical_responsible, notes]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'project', result.insertId, `Obra ${name} cadastrada`]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar projeto' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { client_id, name, location, start_date, expected_end_date, status, service_description, technical_responsible, notes } = req.body;
    await db.query(
      'UPDATE projects SET client_id=?, name=?, location=?, start_date=?, expected_end_date=?, status=?, service_description=?, technical_responsible=?, notes=? WHERE id=?',
      [client_id || null, name, location, start_date || null, expected_end_date || null, status, service_description, technical_responsible, notes, req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'project', req.params.id, `Obra ${name} atualizada`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar projeto' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [proj] = await db.query('SELECT name FROM projects WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'project', req.params.id, `Obra ${proj[0]?.name} excluida`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir projeto' });
  }
});

module.exports = router;
