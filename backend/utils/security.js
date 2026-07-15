function validatePasswordStrength(password) {
  const value = String(password || '');
  const errors = [];
  if (value.length < 8) errors.push('minimo de 8 caracteres');
  if (!/[A-Z]/.test(value)) errors.push('uma letra maiuscula');
  if (!/[a-z]/.test(value)) errors.push('uma letra minuscula');
  if (!/[0-9]/.test(value)) errors.push('um numero');
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('um caractere especial');
  return { ok: errors.length === 0, errors };
}

function isDefaultPassword(password) {
  return String(password || '') === 'admin123';
}

module.exports = {
  validatePasswordStrength,
  isDefaultPassword
};
