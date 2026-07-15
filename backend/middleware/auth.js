const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const secret = process.env.JWT_SECRET;
  
  if (!token) {
    return res.status(401).json({ error: 'Token de autenticacao nao fornecido' });
  }

  if (!secret) {
    return res.status(500).json({ error: 'JWT_SECRET nao configurado no servidor' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para seu perfil' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
