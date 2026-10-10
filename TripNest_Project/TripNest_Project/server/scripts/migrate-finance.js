import { readFile } from 'node:fs/promises';
import { createDatabase } from '../src/db.js';

// #explain_notes: Apply only Mohamed's tables after the team creates users, trips and bookings.
// This script preserves account data and never creates or renews demo sessions.
const db = createDatabase(process.env.DATABASE_URL);
const conn = await db.connect();

try {
  await conn.query('BEGIN');

  for (const name of ['budget.sql', 'wallet.sql', 'cash.sql', 'family.sql']) {
    const sql = await readFile(new URL('../database/' + name, import.meta.url), 'utf8');
    await conn.query(sql);
  }

  await conn.query('COMMIT');
  console.log('Finance tables ready. Existing data preserved.');
} catch (error) {
  await conn.query('ROLLBACK');
  throw error;
} finally {
  conn.release();
  await db.end();
}
