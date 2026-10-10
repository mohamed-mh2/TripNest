import { readFile } from 'node:fs/promises';
import { createDatabase } from '../src/db.js';

const db = createDatabase(process.env.DATABASE_URL);
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query(
    await readFile(new URL('../database/support.sql', import.meta.url), 'utf8'),
  );
  if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
    await client.query(
      "INSERT INTO users(id,name) VALUES ('10000000-0000-4000-8000-000000000003','Demo support agent') ON CONFLICT(id) DO NOTHING",
    );
    await client.query(
      "INSERT INTO support_agents(user_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING",
    );
    await client.query(
      "INSERT INTO sessions(id,user_id,expires_at) VALUES ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',now()+interval '7 days') ON CONFLICT(id) DO UPDATE SET expires_at=now()+interval '7 days',revoked_at=NULL",
    );
  }
  await client.query('COMMIT');
  console.log(
    'Readiness and help center ready. Existing trip and finance data preserved.',
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await db.end();
}
