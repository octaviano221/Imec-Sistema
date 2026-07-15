const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [trainings] = await db.query('SELECT * FROM trainings ORDER BY code');
    res.json(trainings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar treinamentos' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, code, category, description, default_workload, default_validity_months, requires_recycling } = req.body;
    const [result] = await db.query(
      'INSERT INTO trainings (name, code, category, description, default_workload, default_validity_months, requires_recycling) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, code, category, description, default_workload, default_validity_months, requires_recycling]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar treinamento' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { name, code, category, description, default_workload, default_validity_months, requires_recycling, status } = req.body;
    await db.query(
      'UPDATE trainings SET name=?, code=?, category=?, description=?, default_workload=?, default_validity_months=?, requires_recycling=?, status=? WHERE id=?',
      [name, code, category, description, default_workload, default_validity_months, requires_recycling, status, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar treinamento' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM trainings WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir treinamento' });
  }
});

module.exports = router;
