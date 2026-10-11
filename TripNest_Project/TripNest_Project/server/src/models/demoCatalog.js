import { readFile } from 'node:fs/promises';

// #explain_notes: Demo enrichment adds missing services only. Running it again
// preserves existing prices, bookings and customer data rather than resetting them.
export async function seedDemoCatalog(db) {
  const catalog = JSON.parse(
    await readFile(
      new URL('../../database/demo-catalog-extra.json', import.meta.url),
      'utf8',
    ),
  );
  const client = await db.connect();
  let added = 0;
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE services IN SHARE ROW EXCLUSIVE MODE');
    for (const service of catalog) {
      const result = await client.query(
        `
        INSERT INTO services(category,name,provider_name,city,description,unit_price_minor,currency,price_unit,booking_fee_minor,daily_capacity,rating,attributes,free_cancel_hours,late_refund_percent,is_demo)
        SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,true
        WHERE NOT EXISTS (SELECT 1 FROM services WHERE category=$1 AND name=$2 AND provider_name=$3)
        RETURNING id`,
        [
          service.category,
          service.name,
          service.provider_name,
          service.city,
          service.description,
          service.unit_price_minor,
          service.currency,
          service.price_unit,
          service.booking_fee_minor,
          service.daily_capacity,
          service.rating,
          JSON.stringify(service.attributes),
          service.free_cancel_hours,
          service.late_refund_percent,
        ],
      );
      added += result.rowCount;
    }
    const { rows } = await client.query('SELECT count(*)::int AS total FROM services');
    await client.query('COMMIT');
    return { added, total: rows[0].total };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
