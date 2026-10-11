import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createDatabase } from '../src/db.js';
import { setupTokenHash } from '../src/models/accountSetup.js';

const option = (name) =>
  process.argv
    .find((value) => value.startsWith('--' + name + '='))
    ?.slice(name.length + 3);
const email = (option('email') || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
  throw Error('Provide a valid --email address.');
const db = createDatabase(process.env.DATABASE_URL);
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query(
    await readFile(new URL('../database/accounts.sql', import.meta.url), 'utf8'),
  );
  let user = (
    await client.query(
      'SELECT id,name,(password_hash IS NOT NULL) AS active FROM users WHERE lower(email)=$1 FOR UPDATE',
      [email],
    )
  ).rows[0];
  if (!user)
    user = (
      await client.query(
        "INSERT INTO users(id,name,email,role) VALUES($1,'TripNest administrator',$2,'admin') RETURNING id,name,false AS active",
        [randomUUID(), email],
      )
    ).rows[0];
  else await client.query("UPDATE users SET role='admin' WHERE id=$1", [user.id]);
  let activationUrl = null;
  if (!user.active) {
    const token = randomBytes(32).toString('hex');
    await client.query(
      `INSERT INTO account_setup_invitations(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '48 hours')
      ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at,used_at=NULL`,
      [user.id, setupTokenHash(token)],
    );
    // Fragment keeps the invitation out of the HTTP URL sent to the frontend server.
    activationUrl = 'http://127.0.0.1:5173/auth#setup=' + token;
  }
  const output = option('output');
  if (output) {
    const path = resolve(output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      JSON.stringify({ email, active: user.active, activationUrl }, null, 2),
      { mode: 0o600 },
    );
  }
  await client.query('COMMIT');
  console.log(
    user.active
      ? 'Existing account granted administrator access. Its password and trip data were preserved.'
      : 'Administrator account reserved. A private activation link is ready for its owner to choose the initial password.',
  );
  if (!output && activationUrl) console.log(activationUrl);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await db.end();
}
