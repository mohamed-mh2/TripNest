import { readFile } from 'node:fs/promises';
import { createDatabase } from '../src/db.js';

const db = createDatabase(process.env.DATABASE_URL);
const conn = await db.connect();
try {
  await conn.query('BEGIN');
  await conn.query(
    await readFile(new URL('../database/bookings.sql', import.meta.url), 'utf8'),
  );
  const existing = await conn.query('SELECT count(*) FROM services');
  if (Number(existing.rows[0].count) === 0)
    await conn.query(
      await readFile(
        new URL('../database/booking-services.sql', import.meta.url),
        'utf8',
      ),
    );
  if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
    await conn.query(
      "UPDATE trips SET destination_city='Barcelona',start_date=CURRENT_DATE+21,end_date=CURRENT_DATE+28 WHERE id='30000000-0000-4000-8000-000000000001' AND start_date IS NULL AND end_date IS NULL",
    );
  }
  await conn.query('COMMIT');
  console.log(
    'Booking schema and demonstration services ready. Existing finance data preserved.',
  );
} catch (error) {
  await conn.query('ROLLBACK');
  throw error;
} finally {
  conn.release();
  await db.end();
}
