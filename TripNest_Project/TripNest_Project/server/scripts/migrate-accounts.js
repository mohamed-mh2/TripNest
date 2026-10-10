import { readFile } from 'node:fs/promises';
import { createDatabase } from '../src/db.js';
const db = createDatabase(process.env.DATABASE_URL);
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query(
    await readFile(new URL('../database/accounts.sql', import.meta.url), 'utf8'),
  );
  await client.query('COMMIT');
  console.log('Accounts and trip details ready. Existing team data preserved.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await db.end();
}
