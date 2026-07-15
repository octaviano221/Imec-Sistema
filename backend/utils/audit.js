const db = require('../config/db');

async function audit(userId, action, entityType, entityId, description) {
  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId || null, action, entityType, entityId || null, description || '']
    );
  } catch (error) {
    console.warn('Audit log skipped:', error.message);
  }
}

module.exports = audit;
