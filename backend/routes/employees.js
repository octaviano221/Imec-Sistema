const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [employees] = await db.query('SELECT * FROM employees ORDER BY full_name');
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar funcionários' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [employees] = await db.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (employees.length === 0) return res.status(404).json({ error: 'Funcionário não encontrado' });
    res.json(employees[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar funcionário' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { full_name, cpf, rg, birth_date, phone, email, address, role_position, department, admission_date, status, notes, photo_url } = req.body;
    const [result] = await db.query(
      'INSERT INTO employees (full_name, cpf, rg, birth_date, phone, email, address, role_position, department, admission_date, status, notes, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [full_name, cpf, rg, birth_date, phone, email, address, role_position, department, admission_date, status || 'ativo', notes, photo_url]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'employee', result.insertId, `Funcionário ${full_name} cadastrado`]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar funcionário' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { full_name, cpf, rg, birth_date, phone, email, address, role_position, department, admission_date, status, notes, photo_url } = req.body;
    await db.query(
      'UPDATE employees SET full_name=?, cpf=?, rg=?, birth_date=?, phone=?, email=?, address=?, role_position=?, department=?, admission_date=?, status=?, notes=?, photo_url=? WHERE id=?',
      [full_name, cpf, rg, birth_date, phone, email, address, role_position, department, admission_date, status, notes, photo_url, req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'employee', req.params.id, `Funcionário ${full_name} atualizado`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [emp] = await db.query('SELECT full_name FROM employees WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'employee', req.params.id, `Funcionário ${emp[0]?.full_name} excluído`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir funcionário' });
  }
});

module.exports = router;
