import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { seedDemoCatalog } from './models/demoCatalog.js';
import { setupTokenHash } from './models/accountSetup.js';

export function administratorSetupToken(secret) {
  if (!secret || secret.length < 32)
    throw new Error('ADMIN_SETUP_SECRET must contain at least 32 characters.');
  return createHash('sha256').update(secret).digest('hex');
}

// #explain_notes: Public hosting uses the same feature schema, with no shared demo
// identities or pre-authorized sessions. Each traveler registers their own account.
export async function initializeCloudDatabase(db, { adminEmail, adminSetupSecret } = {}) {
  const email = (adminEmail || '').trim().toLowerCase();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254))
    throw new Error('ADMIN_EMAIL is invalid.');
  const token = email ? administratorSetupToken(adminSetupSecret) : null;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(913731)');
    for (const name of [
      'development.sql',
      'budget.sql',
      'wallet.sql',
      'cash.sql',
      'family.sql',
      'bookings.sql',
      'support.sql',
      'accounts.sql',
    ])
      await client.query(
        await readFile(new URL('../database/' + name, import.meta.url), 'utf8'),
      );
    const { rows } = await client.query('SELECT count(*)::int AS total FROM services');
    if (rows[0].total === 0)
      await client.query(
        await readFile(
          new URL('../database/booking-services.sql', import.meta.url),
          'utf8',
        ),
      );
    if (email) {
      // A reserved email cannot be claimed through public registration. Never promote
      // an already registered customer account merely because its email matches.
      let admin = (
        await client.query(
          'SELECT id,role,password_hash FROM users WHERE lower(email)=$1 FOR UPDATE',
          [email],
        )
      ).rows[0];
      if (admin && admin.role !== 'admin')
        throw new Error(
          'ADMIN_EMAIL belongs to an existing customer. Choose a different administrator email.',
        );
      if (!admin)
        admin = (
          await client.query(
            "INSERT INTO users(id,name,email,role) VALUES($1,'TripNest administrator',$2,'admin') RETURNING id,password_hash",
            [randomUUID(), email],
          )
        ).rows[0];
      if (!admin.password_hash) {
        // Retain invitation expiry on restarts, rather than extending access indefinitely.
        await client.query(
          `INSERT INTO account_setup_invitations(user_id,token_hash,expires_at)
          VALUES($1,$2,now()+interval '48 hours') ON CONFLICT(user_id) DO NOTHING`,
          [admin.id, setupTokenHash(token)],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return seedDemoCatalog(db);
}
