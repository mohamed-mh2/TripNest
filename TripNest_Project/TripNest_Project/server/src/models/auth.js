const db = require('../db');

async function createUser({ name, email, passwordHash }) {
  const result = await db.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role, created_at',
    [name, email, passwordHash]
  );
  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await db.query(
    'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await db.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function createSession({ jti, userId, expiresAt }) {
  await db.query(
    'INSERT INTO auth_sessions (jti, user_id, expires_at) VALUES ($1, $2, $3)',
    [jti, userId, expiresAt]
  );
}

async function findActiveSession(jti) {
  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.jti = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [jti]
  );
  return result.rows[0] || null;
}

async function revokeSession(jti) {
  await db.query(
    'UPDATE auth_sessions SET revoked_at = NOW() WHERE jti = $1 AND revoked_at IS NULL',
    [jti]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  createSession,
  findActiveSession,
  revokeSession,
};
