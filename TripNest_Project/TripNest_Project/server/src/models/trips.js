// استعلامات PostgreSQL المعلّمة المعاملات والمعاملات الذرية المطلوبة لـ إنشاء الرحلات وتعديلها وأرشفتها والتحقق من ملكية الرحلة؛ دون كود HTTP. المسؤول: madin abed.
// #explain_notes: Minimal read-only placeholder added by Student 2 so bookings can check trip ownership.
// madin abed can replace it with the full trips model while keeping these two functions.

const db = require('../db');


async function listTripsForUser(userId) {
  const { rows } = await db.query(
    `SELECT * FROM trips
     WHERE user_id = $1 AND status = 'active'
     ORDER BY start_date ASC, id ASC`,
    [userId],
  );

  return rows;
}


async function findTripForUser(userId, tripId, client = db) {
  const { rows } = await client.query(
    'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
    [tripId, userId],
  );

  return rows[0] || null;
}


module.exports = {
  listTripsForUser,
  findTripForUser,
};
