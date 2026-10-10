import { createHash, createHmac, randomUUID } from 'node:crypto';
import { failure } from './budget.js';

export function createFamilyModel(db, secret) {
  // #explain_notes: A purpose-specific secret makes links unguessable; only the hash is stored.
  const tokenFor = (id) =>
    createHmac('sha256', secret)
      .update('tripnest-family-v1:' + id)
      .digest('hex');
  const hash = (token) => createHash('sha256').update(token).digest('hex');
  const status = (row) =>
    row.status === 'pending' && new Date(row.expires_at) <= new Date()
      ? 'expired'
      : row.status;
  const view = (row) => ({
    id: row.id,
    amountMinor: Number(row.amount_minor),
    currency: 'EUR',
    status: status(row),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    simulation: true,
  });
  const receipt = (row) => ({
    id: row.id,
    amountMinor: Number(row.amount_minor),
    currency: 'EUR',
    status: 'paid',
    paidAt: row.paid_at,
    simulation: true,
  });

  async function transaction(work) {
    const conn = await db.connect();
    try {
      await conn.query('BEGIN');
      const value = await work(conn);
      await conn.query('COMMIT');
      return value;
    } catch (error) {
      await conn.query('ROLLBACK');
      throw error;
    } finally {
      conn.release();
    }
  }

  return {
    list: async (user) => {
      const { rows } = await db.query(
        'SELECT * FROM family_requests WHERE recipient_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',
        [user],
      );
      return rows.map(view);
    },

    create: (user, amount, key) =>
      transaction(async (conn) => {
        const id = randomUUID();
        const { rows } = await conn.query(
          'INSERT INTO family_requests(id,recipient_id,amount_minor,token_hash,create_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(recipient_id,create_key) DO UPDATE SET create_key=EXCLUDED.create_key RETURNING *',
          [id, user, amount, hash(tokenFor(id)), key],
        );
        const row = rows[0];
        if (Number(row.amount_minor) !== amount)
          throw failure(409, 'This request key belongs to a different amount.');
        return {
          ...view(row),
          ...(status(row) === 'pending' ? { token: tokenFor(row.id) } : {}),
        };
      }),

    share: async (user, id) => {
      const { rows } = await db.query(
        'SELECT * FROM family_requests WHERE id=$1 AND recipient_id=$2',
        [id, user],
      );
      const row = rows[0];
      if (!row) throw failure(404, 'Support request not found.');
      if (status(row) !== 'pending')
        throw failure(409, 'Only an active request can be shared.');
      return { token: tokenFor(id) };
    },

    cancel: (user, id) =>
      transaction(async (conn) => {
        const { rows } = await conn.query(
          'SELECT * FROM family_requests WHERE id=$1 AND recipient_id=$2 FOR UPDATE',
          [id, user],
        );
        const row = rows[0];
        if (!row) throw failure(404, 'Support request not found.');
        if (row.status === 'cancelled') return view(row);
        if (status(row) !== 'pending')
          throw failure(409, 'Only an unpaid, active request can be cancelled.');
        const updated = await conn.query(
          "UPDATE family_requests SET status='cancelled' WHERE id=$1 RETURNING *",
          [id],
        );
        return view(updated.rows[0]);
      }),

    resolve: async (user, token) => {
      const { rows } = await db.query(
        'SELECT r.*,u.name FROM family_requests r JOIN users u ON u.id=r.recipient_id WHERE r.token_hash=$1',
        [hash(token)],
      );
      const row = rows[0];
      if (!row) throw failure(404, 'Support link not found.');
      // #explain_notes: Donors see an abbreviated name and amount, never the recipient wallet or trip.
      return {
        id: row.id,
        recipientName: (row.name.trim().split(/\s+/)[0] || 'Traveler').slice(0, 30),
        amountMinor: Number(row.amount_minor),
        currency: 'EUR',
        status: status(row),
        expiresAt: row.expires_at,
        canPay: status(row) === 'pending' && row.recipient_id !== user,
        ownRequest: row.recipient_id === user,
        simulation: true,
      };
    },

    pay: (user, token, key, outcome) =>
      transaction(async (conn) => {
        // #explain_notes: Lock the request before checking its status; two donors cannot credit it twice.
        const { rows } = await conn.query(
          'SELECT * FROM family_requests WHERE token_hash=$1 FOR UPDATE',
          [hash(token)],
        );
        const row = rows[0];
        if (!row) throw failure(404, 'Support link not found.');
        if (row.recipient_id === user)
          throw failure(403, 'You cannot fund your own support request.');
        if (row.status === 'paid' && row.payer_id === user && row.payment_key === key)
          return receipt(row);
        if (status(row) !== 'pending')
          throw failure(409, 'This request is already paid, cancelled or expired.');
        if (outcome === 'decline')
          throw failure(402, 'Demo card declined. No credit was added.');
        await conn.query(
          "INSERT INTO wallets(id,owner_id,currency) VALUES($1,$2,'EUR') ON CONFLICT(owner_id) DO NOTHING",
          [randomUUID(), row.recipient_id],
        );
        const wallet = await conn.query(
          'SELECT id FROM wallets WHERE owner_id=$1 FOR UPDATE',
          [row.recipient_id],
        );
        const walletId = wallet.rows[0].id;
        const total = await conn.query(
          'SELECT COALESCE(SUM(amount_minor),0) AS balance FROM wallet_entries WHERE wallet_id=$1',
          [walletId],
        );
        if (
          !Number.isSafeInteger(Number(total.rows[0].balance) + Number(row.amount_minor))
        )
          throw failure(409, 'Wallet balance exceeds the supported range.');
        await conn.query(
          "INSERT INTO wallet_entries(id,wallet_id,amount_minor,kind,request_key) VALUES($1,$2,$3,'family_support',$4)",
          [randomUUID(), walletId, row.amount_minor, row.id],
        );
        const updated = await conn.query(
          "UPDATE family_requests SET status='paid',payer_id=$1,payment_key=$2,paid_at=now() WHERE id=$3 RETURNING *",
          [user, key, row.id],
        );
        return receipt(updated.rows[0]);
      }),
  };
}
