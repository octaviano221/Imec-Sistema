const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validatePasswordStrength, isDefaultPassword } = require('../utils/security');
const audit = require('../utils/audit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde alguns minutos.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha sao obrigatorios' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha invalidos' });
    }

    const user = users[0];
    if (user.status !== 'ativo') {
      return res.status(401).json({ error: 'Usuario inativo' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-mail ou senha invalidos' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'JWT_SECRET nao configurado no servidor' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, client_id: user.client_id },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await audit(user.id, 'login', 'user', user.id, 'Login realizado');

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        client_id: user.client_id,
        must_change_password: !user.password_changed_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro ao realizar login' });
  }
});

router.post('/register', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, role, client_id } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha sao obrigatorios' });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.ok || isDefaultPassword(password)) {
      return res.status(400).json({ error: `Senha fraca. Use ${strength.errors.join(', ')}.` });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'E-mail ja cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, client_id, password_changed_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, email, hashedPassword, role || 'viewer', client_id || null]
    );

    await audit(req.user.id, 'create', 'user', result.insertId, `Usuario ${name} cadastrado`);
    res.status(201).json({ id: result.insertId, name, email, role: role || 'viewer' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuario' });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Senha atual e nova senha sao obrigatorias' });
    }

    const strength = validatePasswordStrength(new_password);
    if (!strength.ok || isDefaultPassword(new_password)) {
      return res.status(400).json({ error: `Senha fraca. Use ${strength.errors.join(', ')}.` });
    }

    const [users] = await db.query('SELECT id, password FROM users WHERE id = ?', [req.user.id]);
    if (!users.length) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const valid = await bcrypt.compare(current_password, users[0].password);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?', [hashedPassword, req.user.id]);
    await audit(req.user.id, 'change_password', 'user', req.user.id, 'Senha alterada pelo usuario');
    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

module.exports = router;
