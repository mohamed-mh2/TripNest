const db = require('../db');
async function checklist(userId, tripId) {
  const trip = await db.query('SELECT id FROM trips WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [tripId, userId]);
  if (!trip.rowCount) return null;
  return (await db.query('SELECT id,label,is_complete AS "isComplete",created_at AS "createdAt" FROM checklist_items WHERE user_id=$1 AND trip_id=$2 ORDER BY id', [userId, tripId])).rows;
}
async function addChecklist(userId, tripId, label) {
  const result = await db.query(
    `INSERT INTO checklist_items(user_id,trip_id,label)
     SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM trips WHERE id=$2 AND user_id=$1 AND archived_at IS NULL)
     ON CONFLICT (trip_id,label) DO NOTHING RETURNING id,label,is_complete AS "isComplete",created_at AS "createdAt"`,
    [userId, tripId, label]
  );
  return result.rows[0] || null;
}
async function updateChecklist(userId, id, complete) {
  const result = await db.query(
    'UPDATE checklist_items SET is_complete=$3 WHERE id=$1 AND user_id=$2 RETURNING id,label,is_complete AS "isComplete"',
    [id, userId, complete]
  );
  return result.rows[0] || null;
}
async function createTicket(userId, tripId, subject, message) {
  if (tripId) {
    const trip = await db.query('SELECT id FROM trips WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [tripId, userId]);
    if (!trip.rowCount) return null;
  }
  const result = await db.query(
    'INSERT INTO support_tickets(user_id,trip_id,subject,message) VALUES($1,$2,$3,$4) RETURNING id,trip_id AS "tripId",subject,message,status,created_at AS "createdAt"',
    [userId, tripId || null, subject, message]
  );
  return result.rows[0];
}
async function tickets(userId, admin) {
  const result = await db.query(
    `SELECT t.id,t.user_id AS "userId",u.name AS "userName",t.trip_id AS "tripId",t.subject,t.message,t.status,
            t.created_at AS "createdAt",t.updated_at AS "updatedAt"
       FROM support_tickets t JOIN users u ON u.id=t.user_id
      WHERE ($2::boolean OR t.user_id=$1) ORDER BY t.created_at DESC`,
    [userId, admin]
  );
  return result.rows;
}
async function resolveTicket(id) {
  const result = await db.query(
    `UPDATE support_tickets SET status='resolved',updated_at=NOW() WHERE id=$1 AND status='open' RETURNING id,status`,
    [id]
  );
  return result.rows[0] || null;
}
async function tripSummary(userId, tripId) {
  const trip = await db.query('SELECT id,name,destination,start_date AS "startDate",end_date AS "endDate",notes FROM trips WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [tripId,userId]);
  if (!trip.rowCount) return null;
  const [items, expenses, savedBookings] = await Promise.all([
    db.query('SELECT label,is_complete AS "isComplete" FROM checklist_items WHERE trip_id=$1 AND user_id=$2 ORDER BY id',[tripId,userId]),
    db.query('SELECT title,category,amount,currency,occurred_at AS "occurredAt" FROM expenses WHERE trip_id=$1 AND user_id=$2 ORDER BY occurred_at',[tripId,userId]),
    db.query('SELECT o.title,s.name AS "service",b.status,b.quantity,b.price_each AS "priceEach",b.currency FROM bookings b JOIN offers o ON o.id=b.offer_id JOIN travel_services s ON s.id=o.service_id WHERE b.trip_id=$1 AND b.user_id=$2 ORDER BY b.created_at',[tripId,userId])
  ]);
  return { trip: trip.rows[0], checklist: items.rows, expenses: expenses.rows, bookings: savedBookings.rows };
}
module.exports = { checklist, addChecklist, updateChecklist, createTicket, tickets, resolveTicket, tripSummary };
