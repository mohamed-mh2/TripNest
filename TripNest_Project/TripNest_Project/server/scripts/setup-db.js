import { readFile } from 'node:fs/promises';
import { createDatabase } from '../src/db.js';
const db = createDatabase(process.env.DATABASE_URL);
try {
  for (const name of [
    'development.sql',
    'budget.sql',
    'wallet.sql',
    'cash.sql',
    'family.sql',
  ])
    await db.query(
      await readFile(new URL('../database/' + name, import.meta.url), 'utf8'),
    );
  await db.query(
    "INSERT INTO users(id,name) VALUES('10000000-0000-4000-8000-000000000001','Traveler (demo)') ON CONFLICT DO NOTHING",
  );
  await db.query(
    "INSERT INTO trips(id,owner_id,title,budget_minor,currency) VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Future trip · local demo',160000,'EUR') ON CONFLICT DO NOTHING",
  );
  await db.query(
    "INSERT INTO sessions(id,user_id,expires_at) VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now()+interval '7 days') ON CONFLICT(id) DO UPDATE SET expires_at=EXCLUDED.expires_at,revoked_at=NULL",
  );
  await db.query(
    "INSERT INTO users(id,name) VALUES('10000000-0000-4000-8000-000000000002','Supporter (demo)') ON CONFLICT DO NOTHING",
  );
  await db.query(
    "INSERT INTO sessions(id,user_id,expires_at) VALUES('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',now()+interval '7 days') ON CONFLICT(id) DO UPDATE SET expires_at=EXCLUDED.expires_at,revoked_at=NULL",
  );
  console.log('Local demo schema and trip ready. Existing budget data preserved.');
} finally {
  await db.end();
}

await import('./migrate-bookings.js');

await import('./migrate-support.js');
