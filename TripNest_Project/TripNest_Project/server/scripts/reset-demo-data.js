import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createDatabase } from '../src/db.js';

// #explain_notes: This maintenance tool resets only the two named local demo accounts.
const backupPath = process.argv.find((arg) => arg.startsWith('--backup='))?.slice(9);
const host = new URL(process.env.DATABASE_URL).hostname;
if (
  process.env.NODE_ENV !== 'development' ||
  process.env.DEMO_MODE !== 'true' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(host) ||
  !process.argv.includes('--confirm-local-demo') ||
  !backupPath
) {
  throw new Error('Local development demo, confirmation and a backup path are required.');
}

const users = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
];
const trip = '30000000-0000-4000-8000-000000000001';
const db = createDatabase(process.env.DATABASE_URL);
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) FOR UPDATE', [users]);
  const queries = {
    trips: [
      'SELECT * FROM trips WHERE id=$1 AND owner_id=$2 FOR UPDATE',
      [trip, users[0]],
    ],
    expenses: ['SELECT * FROM expenses WHERE trip_id=$1', [trip]],
    bookings: ['SELECT * FROM bookings WHERE trip_id=$1', [trip]],
    booking_payment_attempts: ['SELECT * FROM booking_payment_attempts WHERE trip_id=$1', [trip]],
    wallet_entries: [
      'SELECT e.* FROM wallet_entries e JOIN wallets w ON w.id=e.wallet_id WHERE w.owner_id=ANY($1::uuid[])',
      [users],
    ],
    cash_vouchers: [
      'SELECT * FROM cash_vouchers WHERE buyer_id=ANY($1::uuid[]) OR claimed_by=ANY($1::uuid[])',
      [users],
    ],
    family_requests: [
      'SELECT * FROM family_requests WHERE recipient_id=ANY($1::uuid[]) OR payer_id=ANY($1::uuid[])',
      [users],
    ],
  };
  const backup = { createdAt: new Date().toISOString(), tables: {} };
  for (const [table, [sql, params]] of Object.entries(queries)) {
    backup.tables[table] = (await client.query(sql, params)).rows;
  }
  if (backup.tables.trips.length !== 1)
    throw new Error('Expected demo trip was not found.');

  // The backup must finish before the transaction is allowed to remove anything.
  const output = resolve(backupPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(backup, null, 2), { flag: 'wx' });

  await client.query(
    'DELETE FROM family_requests WHERE recipient_id=ANY($1::uuid[]) OR payer_id=ANY($1::uuid[])',
    [users],
  );
  await client.query(
    'DELETE FROM cash_vouchers WHERE buyer_id=ANY($1::uuid[]) OR claimed_by=ANY($1::uuid[])',
    [users],
  );
  await client.query(
    'DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE owner_id=ANY($1::uuid[]))',
    [users],
  );
  await client.query('DELETE FROM expenses WHERE trip_id=$1', [trip]);
  // #explain_notes: Remove dependent demo payment attempts before their booking rows.
  await client.query('DELETE FROM booking_payment_attempts WHERE trip_id=$1', [trip]);
  await client.query('DELETE FROM bookings WHERE trip_id=$1', [trip]);
  await client.query(
    "UPDATE trips SET budget_minor=160000,status='active',title='Future trip · local demo' WHERE id=$1 AND owner_id=$2",
    [trip, users[0]],
  );
  await client.query("UPDATE users SET name='Supporter (demo)' WHERE id=$1", [users[1]]);
  await client.query("UPDATE users SET name='Traveler (demo)' WHERE id=$1", [users[0]]);
  await client.query('COMMIT');
  console.log('Named local demo data reset. Backup saved before reset.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await db.end();
}
