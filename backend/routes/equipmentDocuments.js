const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    let query = `
      SELECT ed.*, eq.name as equipment_name
      FROM equipment_documents ed
      LEFT JOIN equipment eq ON ed.equipment_id = eq.id
    `;
    const params = [];
    if (req.query.equipment_id) {
      query += ' WHERE ed.equipment_id = ?';
      params.push(req.query.equipment_id);
    }
    query += ' ORDER BY ed.created_at DESC';
    const [docs] = await db.query(query, params);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar documentos do equipamento' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [docs] = await db.query(`
      SELECT ed.*, eq.name as equipment_name
      FROM equipment_documents ed
      LEFT JOIN equipment eq ON ed.equipment_id = eq.id
      WHERE ed.id = ?
    `, [req.params.id]);
    if (docs.length === 0) return res.status(404).json({ error: 'Documento nao encontrado' });
    res.json(docs[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar documento' });
  }
});

router.post('/', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { equipment_id, document_type, title, document_number, issue_date, expiration_date, responsible_name, file_url, status, notes } = req.body;
    const [result] = await db.query(
      'INSERT INTO equipment_documents (equipment_id, document_type, title, document_number, issue_date, expiration_date, responsible_name, file_url, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [equipment_id, document_type, title || document_type, document_number, issue_date || null, expiration_date || null, responsible_name, file_url, status || 'valido', notes]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'equipment_document', result.insertId, `Documento cadastrado para equipamento ${equipment_id}`]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar documento do equipamento' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'rh', 'engenharia'), async (req, res) => {
  try {
    const { equipment_id, document_type, title, document_number, issue_date, expiration_date, responsible_name, file_url, status, notes } = req.body;
    await db.query(
      'UPDATE equipment_documents SET equipment_id=?, document_type=?, title=?, document_number=?, issue_date=?, expiration_date=?, responsible_name=?, file_url=?, status=?, notes=? WHERE id=?',
      [equipment_id, document_type, title || document_type, document_number, issue_date || null, expiration_date || null, responsible_name, file_url, status || 'valido', notes, req.params.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'equipment_document', req.params.id, `Documento ${req.params.id} atualizado`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar documento do equipamento' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM equipment_documents WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'equipment_document', req.params.id, `Documento ${req.params.id} excluido`]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir documento do equipamento' });
  }
});

module.exports = router;
