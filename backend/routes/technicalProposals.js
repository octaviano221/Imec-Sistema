const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const editableRoles = ['admin', 'engenharia'];

function normalizePayload(body) {
  return {
    proposal_number: body.proposal_number || '',
    revision: body.revision || 'R00',
    title: body.title || '',
    proposal_type: body.proposal_type || 'locacao_equipamento',
    client_id: body.client_id || null,
    project_id: body.project_id || null,
    contact_name: body.contact_name || '',
    contact_area: body.contact_area || '',
    location: body.location || '',
    request_date: body.request_date || null,
    proposal_date: body.proposal_date || null,
    validity_date: body.validity_date || null,
    status: body.status || 'rascunho',
    scope_summary: body.scope_summary || '',
    technical_scope: body.technical_scope || '',
    equipment_description: body.equipment_description || '',
    contracted_obligations: body.contracted_obligations || '',
    client_obligations: body.client_obligations || '',
    commercial_terms: body.commercial_terms || '',
    payment_terms: body.payment_terms || '',
    delivery_time: body.delivery_time || '',
    warranty_terms: body.warranty_terms || '',
    total_value: body.total_value === '' || body.total_value == null ? null : body.total_value,
    currency: body.currency || 'BRL',
    file_url: body.file_url || '',
    source_model: body.source_model || '',
    notes: body.notes || ''
  };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT tp.*, c.name AS client_name, p.name AS project_name
      FROM technical_proposals tp
      LEFT JOIN clients c ON tp.client_id = c.id
      LEFT JOIN projects p ON tp.project_id = p.id
      ORDER BY tp.proposal_date DESC, tp.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar propostas tecnicas comerciais' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT tp.*, c.name AS client_name, p.name AS project_name
      FROM technical_proposals tp
      LEFT JOIN clients c ON tp.client_id = c.id
      LEFT JOIN projects p ON tp.project_id = p.id
      WHERE tp.id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Proposta nao encontrada' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar proposta' });
  }
});

router.post('/', authenticate, authorize(...editableRoles), async (req, res) => {
  try {
    const data = normalizePayload(req.body);
    const [result] = await db.query(`
      INSERT INTO technical_proposals (
        proposal_number, revision, title, proposal_type, client_id, project_id,
        contact_name, contact_area, location, request_date, proposal_date, validity_date,
        status, scope_summary, technical_scope, equipment_description,
        contracted_obligations, client_obligations, commercial_terms, payment_terms,
        delivery_time, warranty_terms, total_value, currency, file_url, source_model, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.proposal_number, data.revision, data.title, data.proposal_type, data.client_id, data.project_id,
      data.contact_name, data.contact_area, data.location, data.request_date, data.proposal_date, data.validity_date,
      data.status, data.scope_summary, data.technical_scope, data.equipment_description,
      data.contracted_obligations, data.client_obligations, data.commercial_terms, data.payment_terms,
      data.delivery_time, data.warranty_terms, data.total_value, data.currency, data.file_url, data.source_model, data.notes
    ]);
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'technical_proposal', result.insertId, `Proposta ${data.proposal_number || result.insertId} cadastrada`]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar proposta' });
  }
});

router.put('/:id', authenticate, authorize(...editableRoles), async (req, res) => {
  try {
    const data = normalizePayload(req.body);
    await db.query(`
      UPDATE technical_proposals SET
        proposal_number=?, revision=?, title=?, proposal_type=?, client_id=?, project_id=?,
        contact_name=?, contact_area=?, location=?, request_date=?, proposal_date=?, validity_date=?,
        status=?, scope_summary=?, technical_scope=?, equipment_description=?,
        contracted_obligations=?, client_obligations=?, commercial_terms=?, payment_terms=?,
        delivery_time=?, warranty_terms=?, total_value=?, currency=?, file_url=?, source_model=?, notes=?
      WHERE id=?
    `, [
      data.proposal_number, data.revision, data.title, data.proposal_type, data.client_id, data.project_id,
      data.contact_name, data.contact_area, data.location, data.request_date, data.proposal_date, data.validity_date,
      data.status, data.scope_summary, data.technical_scope, data.equipment_description,
      data.contracted_obligations, data.client_obligations, data.commercial_terms, data.payment_terms,
      data.delivery_time, data.warranty_terms, data.total_value, data.currency, data.file_url, data.source_model, data.notes,
      req.params.id
    ]);
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update', 'technical_proposal', req.params.id, `Proposta ${data.proposal_number || req.params.id} atualizada`]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar proposta' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM technical_proposals WHERE id = ?', [req.params.id]);
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete', 'technical_proposal', req.params.id, `Proposta ${req.params.id} excluida`]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir proposta' });
  }
});

module.exports = router;
