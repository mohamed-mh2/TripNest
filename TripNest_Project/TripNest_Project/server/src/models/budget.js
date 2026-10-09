const db = require('../db');
async function listExpenses(userId, tripId) {
  const ownsTrip = await db.query('SELECT id FROM trips WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [tripId,userId]);
  if (!ownsTrip.rowCount) return null;
  const [expenses, total] = await Promise.all([
    db.query('SELECT id,title,category,amount,currency,occurred_at AS "occurredAt",created_at AS "createdAt" FROM expenses WHERE user_id=$1 AND trip_id=$2 ORDER BY occurred_at DESC,id DESC',[userId,tripId]),
    db.query('SELECT currency,SUM(amount) AS total FROM expenses WHERE user_id=$1 AND trip_id=$2 GROUP BY currency',[userId,tripId])
  ]);
  return { expenses: expenses.rows, totals: total.rows };
}
async function addExpense(userId, tripId, expense) {
  const result = await db.query(
    `INSERT INTO expenses(user_id,trip_id,title,category,amount,currency,occurred_at)
     SELECT $1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE)
     WHERE EXISTS(SELECT 1 FROM trips WHERE id=$2 AND user_id=$1 AND archived_at IS NULL)
     RETURNING id,title,category,amount,currency,occurred_at AS "occurredAt"`,
    [userId,tripId,expense.title,expense.category,expense.amount,expense.currency,expense.occurredAt || null]
  );
  return result.rows[0] || null;
}
async function deleteExpense(userId,id) {
  const result = await db.query('DELETE FROM expenses WHERE id=$1 AND user_id=$2 RETURNING id',[id,userId]);
  return result.rowCount>0;
}
module.exports={listExpenses,addExpense,deleteExpense};
