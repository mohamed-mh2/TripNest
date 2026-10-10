const db = require('../db');

async function listForUser(userId) {
  const result = await db.query(
    'SELECT id, name, destination, start_date, end_date, traveler_count, budget_amount, notes, created_at, updated_at FROM trips WHERE user_id = $1 AND archived_at IS NULL ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

async function findForUser(id, userId) {
  const result = await db.query(
    'SELECT id, name, destination, start_date, end_date, traveler_count, budget_amount, notes, created_at, updated_at FROM trips WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
    [id, userId]
  );
  return result.rows[0] || null;
}

async function create({ userId, name, destination, startDate, endDate, travelerCount, budgetAmount, notes }) {
  const result = await db.query(
    'INSERT INTO trips (user_id, name, destination, start_date, end_date, traveler_count, budget_amount, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, destination, start_date, end_date, traveler_count, budget_amount, notes, created_at, updated_at',
    [userId, name, destination, startDate || null, endDate || null, travelerCount, budgetAmount, notes || '']
  );
  return result.rows[0];
}

async function update({ id, userId, name, destination, startDate, endDate, travelerCount, budgetAmount, notes }) {
  const result = await db.query(
    `UPDATE trips SET name = COALESCE($3, name), destination = COALESCE($4, destination),
       start_date = CASE WHEN $5::boolean THEN $6::date ELSE start_date END,
       end_date = CASE WHEN $7::boolean THEN $8::date ELSE end_date END,
       traveler_count = COALESCE($9, traveler_count), budget_amount = COALESCE($10, budget_amount),
       notes = COALESCE($11, notes), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
       RETURNING id, name, destination, start_date, end_date, traveler_count, budget_amount, notes, created_at, updated_at`,
    [id, userId, name ?? null, destination ?? null, startDate !== undefined, startDate || null,
      endDate !== undefined, endDate || null, travelerCount ?? null, budgetAmount ?? null, notes ?? null]
  );
  return result.rows[0] || null;
}

async function archive(id, userId) {
  const result = await db.query(
    'UPDATE trips SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND archived_at IS NULL RETURNING id',
    [id, userId]
  );
  return result.rowCount > 0;
}

module.exports = { listForUser, findForUser, create, update, archive };
