import { randomUUID, createHash } from 'node:crypto';

export const setupTokenHash = (token) => createHash('sha256').update(token).digest('hex');

// #explain_notes: Only the local administrator script can issue an invitation.
// Activation consumes it inside the same transaction as password/session creation.
export function createAccountSetupModel(db) {
  async function inspect(token) {
    const { rows } = await db.query(
      `SELECT u.name,u.email,i.expires_at FROM account_setup_invitations i
       JOIN users u ON u.id=i.user_id WHERE i.token_hash=$1
       AND i.used_at IS NULL AND i.expires_at>now() AND u.password_hash IS NULL`,
      [setupTokenHash(token)],
    );
    return rows[0];
  }

  async function activate(token, passwordHash, expiresAt) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT u.id FROM account_setup_invitations i JOIN users u ON u.id=i.user_id
         WHERE i.token_hash=$1 AND i.used_at IS NULL AND i.expires_at>now()
         AND u.password_hash IS NULL FOR UPDATE OF i,u`,
        [setupTokenHash(token)],
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return null;
      }
      const user = (
        await client.query(
          'UPDATE users SET password_hash=$2 WHERE id=$1 RETURNING id,name,email,role,created_at',
          [rows[0].id, passwordHash],
        )
      ).rows[0];
      await client.query(
        'UPDATE account_setup_invitations SET used_at=now() WHERE user_id=$1',
        [user.id],
      );
      const sessionId = randomUUID();
      await client.query('INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,$3)', [
        sessionId,
        user.id,
        expiresAt,
      ]);
      await client.query('COMMIT');
      return { user, sessionId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return { inspect, activate };
}
