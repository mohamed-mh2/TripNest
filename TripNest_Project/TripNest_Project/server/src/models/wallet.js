const db = require('../db');
async function walletForUser(userId) {
  await db.query('INSERT INTO wallet_accounts(user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  const account = (await db.query('SELECT balance, currency, updated_at AS "updatedAt" FROM wallet_accounts WHERE user_id=$1', [userId])).rows[0];
  const transactions = (await db.query('SELECT id, kind, amount, currency, description, created_at AS "createdAt" FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [userId])).rows;
  return { account, transactions };
}
async function transact({ userId, kind, amount, description, idempotencyKey }) {
  return db.transaction(async (client) => {
    await client.query('INSERT INTO wallet_accounts(user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const account = (await client.query('SELECT balance, currency FROM wallet_accounts WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
    const prior = await client.query('SELECT id, kind, amount, currency, description FROM wallet_transactions WHERE user_id=$1 AND idempotency_key=$2', [userId, idempotencyKey]);
    if (prior.rowCount) return { transaction: prior.rows[0], duplicate: true };
    const balance = Number(account.balance);
    if (kind === 'debit' && amount > balance) return { error: 'insufficient' };
    const next = Math.round((kind === 'credit' ? balance + amount : balance - amount) * 100) / 100;
    await client.query('UPDATE wallet_accounts SET balance=$2, updated_at=NOW() WHERE user_id=$1', [userId, next]);
    const result = await client.query(
      'INSERT INTO wallet_transactions(user_id,kind,amount,currency,description,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,kind,amount,currency,description,created_at AS "createdAt"',
      [userId, kind, amount, account.currency, description, idempotencyKey]
    );
    return { transaction: result.rows[0], balance: next };
  });
}
async function createFamilyRequest({ userId, tripId, amount, message }) {
  if (tripId) {
    const trip = await db.query('SELECT id FROM trips WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [tripId, userId]);
    if (!trip.rowCount) return null;
  }
  const result = await db.query(
    `INSERT INTO family_support_requests(user_id,trip_id,amount,currency,message)
     SELECT $1,$2,$3,COALESCE((SELECT currency FROM wallet_accounts WHERE user_id=$1),'EUR'),$4
     RETURNING id,trip_id AS "tripId",amount,currency,message,status,created_at AS "createdAt"`,
    [userId, tripId || null, amount, message]
  );
  return result.rows[0];
}
async function listFamilyRequests(userId, admin = false) {
  const result = await db.query(
    `SELECT r.id, r.user_id AS "userId", u.name AS "userName", r.trip_id AS "tripId", r.amount,
            r.currency, r.message, r.status, r.created_at AS "createdAt"
       FROM family_support_requests r JOIN users u ON u.id=r.user_id
      WHERE ($2::boolean OR r.user_id=$1) ORDER BY r.created_at DESC`,
    [userId, admin]
  );
  return result.rows;
}
async function decideFamilyRequest(id, adminId, status) {
  return db.transaction(async (client) => {
    const request = await client.query('SELECT * FROM family_support_requests WHERE id=$1 FOR UPDATE', [id]);
    if (!request.rowCount) return { error: 'missing' };
    const row = request.rows[0];
    if (row.status !== 'pending') return { error: 'decided' };
    await client.query('UPDATE family_support_requests SET status=$2 WHERE id=$1', [id, status]);
    if (status === 'approved') {
      await client.query('INSERT INTO wallet_accounts(user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [row.user_id]);
      await client.query('UPDATE wallet_accounts SET balance=ROUND(balance+$2,2), updated_at=NOW() WHERE user_id=$1', [row.user_id, row.amount]);
      await client.query(
        'INSERT INTO wallet_transactions(user_id,kind,amount,currency,description,idempotency_key) VALUES ($1,\'credit\',$2,$3,$4,$5)',
        [row.user_id, row.amount, row.currency, 'Approved family support (simulated)', `family-request-${row.id}`]
      );
    }
    return { status, handledBy: adminId };
  });
}
module.exports = { walletForUser, transact, createFamilyRequest, listFamilyRequests, decideFamilyRequest };
