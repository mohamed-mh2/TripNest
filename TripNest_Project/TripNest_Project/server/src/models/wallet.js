import { randomUUID } from 'node:crypto';
import { failure } from './budget.js';

export function createWalletModel(db) {
  // #explain_notes: Calculate the balance from recorded credits and debits.

  async function snapshot(conn, wallet) {
    const summary = await conn.query(
      'SELECT COALESCE(SUM(amount_minor),0) AS balance, count(*) AS count FROM wallet_entries WHERE wallet_id=$1',
      [wallet.id],
    );
    const balanceMinor = Number(summary.rows[0].balance);
    if (!Number.isSafeInteger(balanceMinor))
      throw failure(409, 'Wallet balance exceeds the supported range.');
    const history = await conn.query(
      'SELECT id,amount_minor,kind,created_at FROM wallet_entries WHERE wallet_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',
      [wallet.id],
    );
    return {
      id: wallet.id,
      currency: wallet.currency,
      balanceMinor,
      entryCount: Number(summary.rows[0].count),
      simulation: true,
      entries: history.rows.map((row) => ({
        id: row.id,
        amountMinor: Number(row.amount_minor),
        kind: row.kind,
        createdAt: row.created_at,
      })),
    };
  }

  // #explain_notes: Run wallet updates together in a database transaction.

  async function withWallet(owner, work) {
    const conn = await db.connect();
    try {
      await conn.query('BEGIN');
      await conn.query(
        "INSERT INTO wallets(id,owner_id,currency) VALUES($1,$2,'EUR') ON CONFLICT(owner_id) DO NOTHING",
        [randomUUID(), owner],
      );
      // Serializes balance updates for this owner, including simultaneous retries.
      const result = await conn.query(
        'SELECT * FROM wallets WHERE owner_id=$1 FOR UPDATE',
        [owner],
      );
      const value = await work(conn, result.rows[0]);
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
    read: (owner) => withWallet(owner, snapshot),
    topup: (owner, amountMinor, key) =>
      withWallet(owner, async (conn, wallet) => {
        const found = await conn.query(
          'SELECT amount_minor,kind FROM wallet_entries WHERE wallet_id=$1 AND request_key=$2',
          [wallet.id, key],
        );
        if (found.rows.length) {
          if (
            Number(found.rows[0].amount_minor) !== amountMinor ||
            found.rows[0].kind !== 'demo_topup'
          )
            throw failure(
              409,
              'This request key was already used for a different operation.',
            );
          return { ...(await snapshot(conn, wallet)), replayed: true };
        }
        const total = await conn.query(
          'SELECT COALESCE(SUM(amount_minor),0) AS balance FROM wallet_entries WHERE wallet_id=$1',
          [wallet.id],
        );
        if (!Number.isSafeInteger(Number(total.rows[0].balance) + amountMinor))
          throw failure(409, 'Wallet balance exceeds the supported range.');
        await conn.query(
          "INSERT INTO wallet_entries(id,wallet_id,amount_minor,kind,request_key) VALUES($1,$2,$3,'demo_topup',$4)",
          [randomUUID(), wallet.id, amountMinor, key],
        );
        return { ...(await snapshot(conn, wallet)), replayed: false };
      }),
  };
}
