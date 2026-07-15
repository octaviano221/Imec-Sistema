const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [logs] = await db.query(`
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 50
    `);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
  }
});

module.exports = router;
