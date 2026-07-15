const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [equipment] = await db.query('SELECT * FROM equipment ORDER BY name');
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar equipamentos' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [equipment] = await db.query('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    if (equipment.length === 0) return res.status(404).json({ error: 'Equipamento nao encontrado' });
    res.json(equipment[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar equipamento' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, type, brand, model, serial_number, asset_number, plate, year, capacity, owner, status, photo_url, notes } = req.body;
    const [result] = await db.query(
      'INSERT INTO equipment (name, type, brand, model, serial_number, asset_number, plate, year, capacity, owner, status, photo_url, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, brand, model, serial_number, asset_number, plate, year, capacity, owner, status || 'ativo', photo_url, notes]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'equipment', result.insertId, `Equipamento ${name} cadastrado`]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar equipamento' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, type, brand, model, serial_number, asset_number, plate, year, capacity, owner, status, photo_url, notes } = req.body;
    await db.query(
      'UPDATE equipment SET name=?, type=?, brand=?, model=?, serial_number=?, asset_number=?, plate=?, year=?, capacity=?, owner=?, status=?, photo_url=?, notes=? WHERE id=?',
      [name, type, brand, model, serial_number, asset_number, plate, year, capacity, owner, status || 'ativo', photo_url, notes, req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'equipment', req.params.id, `Equipamento ${name} atualizado`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar equipamento' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [eq] = await db.query('SELECT name FROM equipment WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM equipment WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'equipment', req.params.id, `Equipamento ${eq[0]?.name} excluido`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir equipamento' });
  }
});

module.exports = router;
