import { randomUUID } from 'node:crypto';

export function createAuthModel(db) {
  const fields = 'id,name,email,role,created_at';
  async function createAccountSession(credentials, expiresAt) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING ${fields}`,
        [randomUUID(), credentials.name, credentials.email, credentials.passwordHash],
      );
      const sessionId = randomUUID();
      await client.query('INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,$3)', [
        sessionId,
        rows[0].id,
        expiresAt,
      ]);
      await client.query('COMMIT');
      return { user: rows[0], sessionId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async function findByEmail(email) {
    const { rows } = await db.query(
      `SELECT ${fields},password_hash FROM users WHERE lower(email)=$1`,
      [email],
    );
    return rows[0];
  }
  async function findById(id) {
    const { rows } = await db.query(`SELECT ${fields} FROM users WHERE id=$1`, [id]);
    return rows[0];
  }
  async function createSession(userId, expiresAt) {
    const id = randomUUID();
    await db.query('INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,$3)', [
      id,
      userId,
      expiresAt,
    ]);
    return id;
  }
  async function revokeSession(id, userId) {
    await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2', [
      id,
      userId,
    ]);
  }
  return { createAccountSession, findByEmail, findById, createSession, revokeSession };
}
