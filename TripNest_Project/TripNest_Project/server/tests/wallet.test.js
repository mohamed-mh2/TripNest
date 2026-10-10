import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
const secret = 'test-secret-only-abcdefghijklmnopqrstuvwxyz';

async function prepare(exec, query) {
  for (const file of ['development.sql', 'wallet.sql'])
    await exec(await readFile(new URL('../database/' + file, import.meta.url), 'utf8'));
  const u = randomUUID(),
    other = randomUUID(),
    sid = randomUUID(),
    sid2 = randomUUID();
  await query('INSERT INTO users VALUES($1,$2),($3,$4)', [
    u,
    'Wallet owner',
    other,
    'Other user',
  ]);
  await query(
    "INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 day'),($3,$4,now()+interval '1 day')",
    [sid, u, sid2, other],
  );
  await query("INSERT INTO trips VALUES($1,$2,'Plan untouched',160000,'EUR','active')", [
    randomUUID(),
    u,
  ]);
  const sign = (sub, sid) =>
    jwt.sign({ sid }, secret, {
      subject: sub,
      issuer: 'tripnest',
      audience: 'tripnest-web',
      expiresIn: '1h',
    });
  return { owner: sign(u, sid), other: sign(other, sid2), userId: u, otherId: other };
}

function methods(app, auth) {
  return {
    get: () =>
      request(app)
        .get('/api/wallet')
        .set('Authorization', 'Bearer ' + auth),
    add: (amount, key, extra = {}) =>
      request(app)
        .post('/api/wallet/topups')
        .set('Authorization', 'Bearer ' + auth)
        .set('Idempotency-Key', key)
        .send({ amountMinor: amount, ...extra }),
  };
}
test('wallet validates amounts, isolates users, retries once and never changes the trip budget', async () => {
  const engine = new PGlite();
  const db = {
    query: (...args) => engine.query(...args),
    connect: async () => ({ query: (...args) => engine.query(...args), release() {} }),
  };
  try {
    const ids = await prepare(
      (sql) => engine.exec(sql),
      (...args) => engine.query(...args),
    );
    const app = createApp(db, { secret }),
      a = methods(app, ids.owner),
      b = methods(app, ids.other);
    await request(app).get('/api/wallet').expect(401);
    assert.equal((await a.get().expect(200)).body.balanceMinor, 0);
    for (const amount of [0, -10, 1.5, 500001, '10000'])
      await a.add(amount, randomUUID()).expect(400);
    await a.add(10000, 'not-a-uuid').expect(400);
    const key = randomUUID();
    let res = await a.add(10000, key, { ownerId: ids.otherId }).expect(200);
    assert.equal(res.body.balanceMinor, 10000);
    assert.equal(res.body.simulation, true);
    res = await a.add(10000, key).expect(200);
    assert.equal(res.body.entryCount, 1);
    assert.equal(res.body.replayed, true);
    await a.add(20000, key).expect(409);
    assert.equal((await b.get().expect(200)).body.balanceMinor, 0);
    assert.equal((await a.get().expect(200)).body.entries.length, 1);
    const plan = await engine.query('SELECT budget_minor FROM trips WHERE owner_id=$1', [
      ids.userId,
    ]);
    assert.equal(Number(plan.rows[0].budget_minor), 160000);
  } finally {
    await engine.close();
  }
});
test(
  'real PostgreSQL: concurrent same-key credits once, different keys both apply',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const schema = 'wallet_test_' + randomUUID().replaceAll('-', '');
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    let db;
    try {
      await admin.query('CREATE SCHEMA ' + schema);
      db = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        options: '-c search_path=' + schema,
      });
      const ids = await prepare(
        (sql) => db.query(sql),
        (...args) => db.query(...args),
      );
      const app = createApp(db, { secret }),
        a = methods(app, ids.owner),
        key = randomUUID();
      const same = await Promise.all([a.add(10000, key), a.add(10000, key)]);
      assert.ok(same.every((r) => r.status === 200));
      assert.equal((await a.get()).body.balanceMinor, 10000);
      assert.equal((await a.get()).body.entryCount, 1);
      const different = await Promise.all([
        a.add(5000, randomUUID()),
        a.add(2500, randomUUID()),
      ]);
      assert.ok(different.every((r) => r.status === 200));
      const final = await a.get();
      assert.equal(final.body.balanceMinor, 17500);
      assert.equal(final.body.entryCount, 3);
    } finally {
      if (db) await db.end();
      // Only remove the uniquely named schema created by this test.
      assert.match(schema, /^wallet_test_[a-f0-9]{32}$/);
      await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
      await admin.end();
    }
  },
);
