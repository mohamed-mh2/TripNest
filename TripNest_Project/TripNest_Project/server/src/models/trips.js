import { randomUUID } from 'node:crypto';

export function createTripsModel(db) {
  function publicTrip(row) {
    return {
      id: row.id,
      name: row.title,
      destination: row.destination_city,
      start_date: row.start_date?.toISOString?.().slice(0, 10) ?? row.start_date,
      end_date: row.end_date?.toISOString?.().slice(0, 10) ?? row.end_date,
      traveler_count: row.traveler_count,
      budget_amount: Number(row.budget_minor) / 100,
      currency: row.currency,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
  async function listForUser(userId) {
    const { rows } = await db.query(
      'SELECT * FROM trips WHERE owner_id=$1 ORDER BY created_at DESC,id',
      [userId],
    );
    return rows.map(publicTrip);
  }
  async function findForUser(id, userId, client = db, lock = false) {
    const { rows } = await client.query(
      'SELECT * FROM trips WHERE id=$1 AND owner_id=$2' + (lock ? ' FOR UPDATE' : ''),
      [id, userId],
    );
    return rows[0] ? publicTrip(rows[0]) : null;
  }
  async function create(input, userId) {
    const { rows } = await db.query(
      `INSERT INTO trips(id,owner_id,title,destination_city,start_date,end_date,traveler_count,budget_minor,currency,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'EUR',$9) RETURNING *`,
      [
        randomUUID(),
        userId,
        input.name,
        input.destination,
        input.startDate ?? null,
        input.endDate ?? null,
        input.travelerCount,
        Math.round(input.budgetAmount * 100),
        input.notes ?? '',
      ],
    );
    return publicTrip(rows[0]);
  }
  async function update(id, userId, patch) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const current = await findForUser(id, userId, client, true);
      if (!current) {
        await client.query('COMMIT');
        return null;
      }
      if (current.status === 'archived')
        throw Object.assign(new Error('Restore this trip before editing it.'), {
          status: 409,
        });
      const start = patch.startDate !== undefined ? patch.startDate : current.start_date;
      const end = patch.endDate !== undefined ? patch.endDate : current.end_date;
      if (start && end && end < start)
        throw Object.assign(new Error('End date must be on or after the start date.'), {
          status: 400,
          code: 'VALIDATION',
          fields: { endDate: 'Invalid date range.' },
        });
      const { rows } = await client.query(
        `UPDATE trips SET title=$3,destination_city=$4,start_date=$5,end_date=$6,traveler_count=$7,budget_minor=$8,notes=$9,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`,
        [
          id,
          userId,
          patch.name ?? current.name,
          patch.destination ?? current.destination,
          start,
          end,
          patch.travelerCount ?? current.traveler_count,
          Math.round((patch.budgetAmount ?? current.budget_amount) * 100),
          patch.notes ?? current.notes,
        ],
      );
      await client.query('COMMIT');
      return publicTrip(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async function changeStatus(id, userId, status) {
    const { rows } = await db.query(
      'UPDATE trips SET status=$3,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *',
      [id, userId, status],
    );
    return rows[0] ? publicTrip(rows[0]) : null;
  }
  return { listForUser, findForUser, create, update, changeStatus };
}
