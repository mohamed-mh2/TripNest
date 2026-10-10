import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createCashModel } from '../src/models/cash.js';
test(
  'cash: gifts, one-time redemption, pickup ownership, retries and concurrent spending',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const schema = 'cash_test_' + randomUUID().replaceAll('-', ''),
      admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    let db;
    try {
      await admin.query('CREATE SCHEMA ' + schema);
      db = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        options: '-c search_path=' + schema,
      });
      for (const file of ['development.sql', 'wallet.sql', 'cash.sql'])
        await db.query(
          await readFile(new URL('../database/' + file, import.meta.url), 'utf8'),
        );
      const a = randomUUID(),
        b = randomUUID();
      await db.query('INSERT INTO users VALUES($1,$2),($3,$4)', [
        a,
        'Buyer',
        b,
        'Recipient',
      ]);
      const m = createCashModel(db, 'test-secret-only-abcdefghijklmnopqrstuvwxyz');
      const key = randomUUID(),
        v = await m.buy(a, 'rescue', 'demo_card', key);
      assert.equal(v.amountMinor, 10000);
      assert.equal((await m.buy(a, 'rescue', 'demo_card', key)).id, v.id);
      await assert.rejects(m.buy(a, 'explore', 'demo_card', key), /different purchase/);
      await assert.rejects(m.buy(b, 'essentials', 'wallet', randomUUID()), /Not enough/);
      const results = await Promise.allSettled([
        m.redeem(a, v.code, 'wallet'),
        m.redeem(b, v.code, 'wallet'),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const winner = results[0].status === 'fulfilled' ? a : b;
      await m.redeem(winner, v.code, 'wallet');
      const sums = await db.query(
        'SELECT SUM(amount_minor) AS total,COUNT(*) AS count FROM wallet_entries',
      );
      assert.equal(Number(sums.rows[0].total), 10000);
      assert.equal(Number(sums.rows[0].count), 1);
      await assert.rejects(m.redeem(winner, v.code, 'cash'), /already been used/);
      const purchases = await Promise.allSettled([
        m.buy(winner, 'rescue', 'wallet', randomUUID()),
        m.buy(winner, 'rescue', 'wallet', randomUUID()),
      ]);
      assert.equal(purchases.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(
        Number(
          (await db.query('SELECT SUM(amount_minor) AS total FROM wallet_entries'))
            .rows[0].total,
        ),
        0,
      );
      const cash = await m.buy(a, 'essentials', 'demo_card', randomUUID());
      await m.redeem(b, cash.code, 'cash');
      await assert.rejects(m.collect(a, cash.id), /not found/);
      assert.equal((await m.collect(b, cash.id)).status, 'collected');
      assert.equal((await m.collect(b, cash.id)).status, 'collected');
      await assert.rejects(m.redeem(b, cash.code, 'wallet'), /already been used/);
      const expired = await m.buy(a, 'essentials', 'demo_card', randomUUID());
      await db.query(
        "UPDATE cash_vouchers SET expires_at=now()-interval '1 second' WHERE id=$1",
        [expired.id],
      );
      await assert.rejects(m.redeem(b, expired.code, 'wallet'), /expired/);
      assert.ok((await m.list(b)).every((x) => !x.code || x.purchasedByYou));
    } finally {
      if (db) await db.end();
      assert.match(schema, /^cash_test_[a-f0-9]{32}$/);
      await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
      await admin.end();
    }
  },
);
