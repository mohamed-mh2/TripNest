import { createHash, createHmac, randomUUID } from 'node:crypto';
import { failure } from './budget.js';

// #explain_notes: Prices come from the server, in cents (5000 = EUR 50).

export const cashPackages = [
  {
    id: 'essentials',
    name: 'Cash essentials',
    amountMinor: 5000,
    description: 'Small everyday purchases and a little backup.',
  },
  {
    id: 'rescue',
    name: 'Travel backup',
    amountMinor: 10000,
    description: 'A helping hand when your own payment card is unavailable.',
  },
  {
    id: 'explore',
    name: 'Explore with cash',
    amountMinor: 25000,
    description: 'A larger cash allowance for your trip.',
  },
];

export function createCashModel(db, secret) {
  // #explain_notes: Derive a gift code with the server secret; store only its hash.
  const codeFor = (id) =>
    'TN-' +
    createHmac('sha256', secret)
      .update('tripnest-cash-v1:' + id)
      .digest('hex')
      .slice(0, 24)
      .toUpperCase();
  const hash = (code) =>
    createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  const view = (row, withCode = false) => ({
    id: row.id,
    packageId: row.package_id,
    amountMinor: Number(row.amount_minor),
    status: row.status,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    ...(withCode && row.status === 'ready' ? { code: codeFor(row.id) } : {}),
  });

  // #explain_notes: Either every database change succeeds, or all changes are rolled back.

  async function transaction(work) {
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      const result = await work(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  // #explain_notes: Lock the wallet so simultaneous purchases cannot overspend its balance.

  async function lockWallet(c, user) {
    await c.query(
      "INSERT INTO wallets(id,owner_id,currency) VALUES($1,$2,'EUR') ON CONFLICT(owner_id) DO NOTHING",
      [randomUUID(), user],
    );
    const { rows } = await c.query(
      'SELECT id FROM wallets WHERE owner_id=$1 FOR UPDATE',
      [user],
    );
    return rows[0].id;
  }
  return {
    list: async (user) => {
      const result = await db.query(
        'SELECT * FROM cash_vouchers WHERE buyer_id=$1 OR claimed_by=$1 ORDER BY created_at DESC LIMIT 50',
        [user],
      );
      return result.rows.map((row) => ({
        ...view(row, row.buyer_id === user),
        canCollect: row.claimed_by === user && row.status === 'pickup_reserved',
        purchasedByYou: row.buyer_id === user,
      }));
    },

    // #explain_notes: Repeated requests with the same key return the original purchase.
    buy: (user, packId, method, key) =>
      transaction(async (c) => {
        const pack = cashPackages.find((p) => p.id === packId);
        if (!pack) throw failure(400, 'Unknown cash package.');
        const wallet = await lockWallet(c, user);
        const prior = await c.query(
          'SELECT * FROM cash_vouchers WHERE buyer_id=$1 AND request_key=$2',
          [user, key],
        );
        if (prior.rows.length) {
          const row = prior.rows[0];
          if (row.package_id !== packId || row.payment_method !== method)
            throw failure(409, 'This request key belongs to a different purchase.');
          return view(row, true);
        }
        if (method === 'wallet') {
          const result = await c.query(
            'SELECT COALESCE(SUM(amount_minor),0) AS balance FROM wallet_entries WHERE wallet_id=$1',
            [wallet],
          );
          if (Number(result.rows[0].balance) < pack.amountMinor)
            throw failure(
              409,
              'Not enough demo wallet credit. Choose the saved test card or add funds.',
            );
        }
        const id = randomUUID();
        const result = await c.query(
          'INSERT INTO cash_vouchers(id,buyer_id,package_id,amount_minor,payment_method,request_key,code_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [id, user, packId, pack.amountMinor, method, key, hash(codeFor(id))],
        );
        if (method === 'wallet')
          await c.query(
            "INSERT INTO wallet_entries(id,wallet_id,amount_minor,kind,request_key) VALUES($1,$2,$3,'cash_purchase',$4)",
            [randomUUID(), wallet, -pack.amountMinor, randomUUID()],
          );
        return view(result.rows[0], true);
      }),

    // #explain_notes: Lock the voucher so only one recipient can claim it.
    redeem: (user, code, mode) =>
      transaction(async (c) => {
        const result = await c.query(
          'SELECT * FROM cash_vouchers WHERE code_hash=$1 FOR UPDATE',
          [hash(code)],
        );
        const row = result.rows[0];
        if (!row)
          throw failure(404, 'Code not found. Check the full code and try again.');
        const target = mode === 'wallet' ? 'wallet_credited' : 'pickup_reserved';
        if (row.status !== 'ready') {
          if (
            row.claimed_by === user &&
            (row.status === target || (mode === 'cash' && row.status === 'collected'))
          )
            return view(row);
          throw failure(
            409,
            'This code has already been used. It cannot be redeemed again or switched to another option.',
          );
        }
        if (new Date(row.expires_at) <= new Date())
          throw failure(410, 'This demo code has expired.');
        if (mode === 'wallet') {
          const wallet = await lockWallet(c, user);
          const sum = await c.query(
            'SELECT COALESCE(SUM(amount_minor),0) AS balance FROM wallet_entries WHERE wallet_id=$1',
            [wallet],
          );
          if (
            !Number.isSafeInteger(Number(sum.rows[0].balance) + Number(row.amount_minor))
          )
            throw failure(409, 'Wallet balance exceeds the supported range.');
          await c.query(
            "INSERT INTO wallet_entries(id,wallet_id,amount_minor,kind,request_key) VALUES($1,$2,$3,'cash_to_wallet',$4)",
            [randomUUID(), wallet, row.amount_minor, randomUUID()],
          );
        }
        const updated = await c.query(
          'UPDATE cash_vouchers SET claimed_by=$1,status=$2 WHERE id=$3 RETURNING *',
          [user, target, row.id],
        );
        return view(updated.rows[0]);
      }),

    // #explain_notes: Only the recipient who reserved pickup may complete it.
    collect: (user, id) =>
      transaction(async (c) => {
        const result = await c.query(
          'SELECT * FROM cash_vouchers WHERE id=$1 AND claimed_by=$2 FOR UPDATE',
          [id, user],
        );
        const row = result.rows[0];
        if (!row) throw failure(404, 'Pickup not found.');
        if (row.status === 'collected') return view(row);
        if (row.status !== 'pickup_reserved')
          throw failure(409, 'This package is not reserved for cash pickup.');
        if (new Date(row.expires_at) <= new Date())
          throw failure(410, 'This demo pickup has expired.');
        const updated = await c.query(
          "UPDATE cash_vouchers SET status='collected' WHERE id=$1 RETURNING *",
          [id],
        );
        return view(updated.rows[0]);
      }),
  };
}
