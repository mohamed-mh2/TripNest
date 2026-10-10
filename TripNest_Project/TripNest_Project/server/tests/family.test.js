import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
const secret = 'family-test-secret-only-abcdefghijklmnopqrstuvwxyz';
async function prepare(exec, query) {
  for (const name of ['development.sql', 'wallet.sql', 'cash.sql', 'family.sql'])
    await exec(await readFile(new URL('../database/' + name, import.meta.url), 'utf8'));
  const users = [randomUUID(), randomUUID(), randomUUID()],
    sessions = [randomUUID(), randomUUID(), randomUUID()];
  for (let i = 0; i < 3; i++) {
    await query('INSERT INTO users VALUES($1,$2)', [
      users[i],
      ['Traveler Full Name', 'Donor One', 'Donor Two'][i],
    ]);
    await query(
      "INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [sessions[i], users[i]],
    );
  }
  await query(
    "INSERT INTO trips VALUES($1,$2,'Budget untouched',160000,'EUR','active')",
    [randomUUID(), users[0]],
  );
  const tokens = users.map((sub, i) =>
    jwt.sign({ sid: sessions[i] }, secret, {
      subject: sub,
      issuer: 'tripnest',
      audience: 'tripnest-web',
      expiresIn: '1h',
    }),
  );
  return { users, tokens };
}
function api(app, token) {
  return (method, path, body, key) => {
    const req = request(app)
      [method]('/api/support-requests' + path)
      .set('Authorization', 'Bearer ' + token);
    if (key) req.set('Idempotency-Key', key);
    return req.send(body);
  };
}
test('family API: amounts, privacy, self-payment, decline, retry, expiry, cancellation and one credit', async () => {
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
      owner = api(app, ids.tokens[0]),
      donor = api(app, ids.tokens[1]),
      other = api(app, ids.tokens[2]);
    await request(app).get('/api/support-requests').expect(401);
    for (const amountMinor of [0, 499, 500001, 5.5, '10000'])
      await owner('post', '', { amountMinor }, randomUUID()).expect(400);
    await owner('post', '', { amountMinor: 10000 }, 'bad-key').expect(400);
    const key = randomUUID();
    const gift = (
      await owner(
        'post',
        '',
        { amountMinor: 10000, recipientId: ids.users[1] },
        key,
      ).expect(200)
    ).body;
    const replay = (await owner('post', '', { amountMinor: 10000 }, key).expect(200))
      .body;
    assert.equal(replay.id, gift.id);
    assert.equal(replay.token, gift.token);
    await owner('post', '', { amountMinor: 5000 }, key).expect(409);
    const list = (await owner('get', '').expect(200)).body;
    assert.equal(list.length, 1);
    assert.ok(!('token' in list[0]));
    assert.ok(!('token_hash' in list[0]));
    assert.deepEqual((await donor('get', '').expect(200)).body, []);
    await donor('post', '/' + gift.id + '/cancel').expect(404);
    await donor('post', '/' + gift.id + '/share').expect(404);
    assert.equal(
      (await owner('post', '/' + gift.id + '/share').expect(200)).body.token,
      gift.token,
    );
    await donor('post', '/resolve', { token: 'bad' }).expect(400);
    await donor('post', '/resolve', { token: 'a'.repeat(64) }).expect(404);
    const preview = (await donor('post', '/resolve', { token: gift.token }).expect(200))
      .body;
    assert.equal(preview.recipientName, 'Traveler');
    assert.equal(preview.canPay, true);
    assert.ok(!('recipientId' in preview));
    assert.ok(!('balanceMinor' in preview));
    assert.ok(!('tripId' in preview));
    await owner(
      'post',
      '/pay',
      { token: gift.token, testOutcome: 'approve' },
      randomUUID(),
    ).expect(403);
    await donor(
      'post',
      '/pay',
      { token: gift.token, testOutcome: 'decline' },
      randomUUID(),
    ).expect(402);
    assert.equal(
      Number((await engine.query('SELECT count(*) AS n FROM wallet_entries')).rows[0].n),
      0,
    );
    const payment = randomUUID();
    const receipt = (
      await donor(
        'post',
        '/pay',
        { token: gift.token, testOutcome: 'approve', amountMinor: 1 },
        payment,
      ).expect(200)
    ).body;
    assert.equal(receipt.amountMinor, 10000);
    assert.ok(!('balanceMinor' in receipt));
    await donor(
      'post',
      '/pay',
      { token: gift.token, testOutcome: 'approve' },
      payment,
    ).expect(200);
    await other(
      'post',
      '/pay',
      { token: gift.token, testOutcome: 'approve' },
      randomUUID(),
    ).expect(409);
    await owner('post', '/' + gift.id + '/cancel').expect(409);
    await owner('post', '/' + gift.id + '/share').expect(409);
    const cancelled = (
      await owner('post', '', { amountMinor: 500 }, randomUUID()).expect(200)
    ).body;
    await owner('post', '/' + cancelled.id + '/cancel').expect(200);
    await owner('post', '/' + cancelled.id + '/cancel').expect(200);
    await donor(
      'post',
      '/pay',
      { token: cancelled.token, testOutcome: 'approve' },
      randomUUID(),
    ).expect(409);
    const expired = (
      await owner('post', '', { amountMinor: 500 }, randomUUID()).expect(200)
    ).body;
    await engine.query(
      "UPDATE family_requests SET expires_at=now()-interval '1 second' WHERE id=$1",
      [expired.id],
    );
    assert.equal(
      (await donor('post', '/resolve', { token: expired.token }).expect(200)).body.status,
      'expired',
    );
    await donor(
      'post',
      '/pay',
      { token: expired.token, testOutcome: 'approve' },
      randomUUID(),
    ).expect(409);
    const final = await engine.query('SELECT amount_minor,kind FROM wallet_entries');
    assert.equal(final.rows.length, 1);
    assert.equal(Number(final.rows[0].amount_minor), 10000);
    assert.equal(final.rows[0].kind, 'family_support');
    assert.equal(
      Number((await engine.query('SELECT budget_minor FROM trips')).rows[0].budget_minor),
      160000,
    );
  } finally {
    await engine.close();
  }
});

test(
  'real PostgreSQL: concurrent donors, creation retries and payment/cancellation race',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const schema = 'family_test_' + randomUUID().replaceAll('-', ''),
      admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
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
        owner = api(app, ids.tokens[0]),
        a = api(app, ids.tokens[1]),
        b = api(app, ids.tokens[2]);
      const key = randomUUID();
      const creations = await Promise.all([
        owner('post', '', { amountMinor: 10000 }, key),
        owner('post', '', { amountMinor: 10000 }, key),
      ]);
      assert.ok(creations.every((r) => r.status === 200));
      assert.equal(creations[0].body.id, creations[1].body.id);
      const gift = creations[0].body;
      const outcomes = await Promise.all([
        a('post', '/pay', { token: gift.token, testOutcome: 'approve' }, randomUUID()),
        b('post', '/pay', { token: gift.token, testOutcome: 'approve' }, randomUUID()),
      ]);
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
      const race = (await owner('post', '', { amountMinor: 5000 }, randomUUID())).body;
      const results = await Promise.all([
        owner('post', '/' + race.id + '/cancel'),
        a('post', '/pay', { token: race.token, testOutcome: 'approve' }, randomUUID()),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const status = (
        await db.query('SELECT status FROM family_requests WHERE id=$1', [race.id])
      ).rows[0].status;
      const sum = await db.query(
        'SELECT SUM(amount_minor) AS total,count(*) AS count FROM wallet_entries',
      );
      assert.equal(Number(sum.rows[0].total), status === 'paid' ? 15000 : 10000);
      assert.equal(Number(sum.rows[0].count), status === 'paid' ? 2 : 1);
    } finally {
      if (db) await db.end();
      assert.match(schema, /^family_test_[a-f0-9]{32}$/);
      await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
      await admin.end();
    }
  },
);
