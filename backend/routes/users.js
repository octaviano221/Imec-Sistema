const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validatePasswordStrength, isDefaultPassword } = require('../utils/security');
const audit = require('../utils/audit');

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email, role, status, client_id, password_changed_at, created_at FROM users ORDER BY name');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuarios' });
  }
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, role, client_id } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha sao obrigatorios' });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.ok || isDefaultPassword(password)) {
      return res.status(400).json({ error: `Senha fraca. Use ${strength.errors.join(', ')}.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, client_id, password_changed_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, email, hashedPassword, role || 'viewer', client_id || null]
    );
    await audit(req.user.id, 'create', 'user', result.insertId, `Usuario ${name} cadastrado`);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuario' });
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, role, status, client_id, password } = req.body;
    if (password) {
      const strength = validatePasswordStrength(password);
      if (!strength.ok || isDefaultPassword(password)) {
        return res.status(400).json({ error: `Senha fraca. Use ${strength.errors.join(', ')}.` });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET name=?, email=?, role=?, status=?, client_id=?, password=?, password_changed_at=NOW() WHERE id=?',
        [name, email, role, status, client_id || null, hashedPassword, req.params.id]
      );
    } else {
      await db.query(
        'UPDATE users SET name=?, email=?, role=?, status=?, client_id=? WHERE id=?',
        [name, email, role, status, client_id || null, req.params.id]
      );
    }
    await audit(req.user.id, 'update', 'user', req.params.id, `Usuario ${name} atualizado`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuario' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ? AND id != ?', [req.params.id, req.user.id]);
    await audit(req.user.id, 'delete', 'user', req.params.id, 'Usuario excluido');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir usuario' });
  }
});

module.exports = router;
