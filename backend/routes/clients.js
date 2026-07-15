const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [clients] = await db.query('SELECT * FROM clients ORDER BY name');
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [clients] = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (clients.length === 0) return res.status(404).json({ error: 'Cliente nao encontrado' });
    res.json(clients[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, cnpj, contact_name, phone, email, address, city, state, notes } = req.body;
    const [result] = await db.query(
      'INSERT INTO clients (name, cnpj, contact_name, phone, email, address, city, state, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, cnpj, contact_name, phone, email, address, city, state, notes]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'client', result.insertId, `Cliente ${name} cadastrado`]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, cnpj, contact_name, phone, email, address, city, state, notes } = req.body;
    await db.query(
      'UPDATE clients SET name=?, cnpj=?, contact_name=?, phone=?, email=?, address=?, city=?, state=?, notes=? WHERE id=?',
      [name, cnpj, contact_name, phone, email, address, city, state, notes, req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'client', req.params.id, `Cliente ${name} atualizado`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [client] = await db.query('SELECT name FROM clients WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'client', req.params.id, `Cliente ${client[0]?.name} excluido`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
});

module.exports = router;
