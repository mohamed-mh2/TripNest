import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';

// Isolated PostgreSQL-compatible test engine; never touches the local demo database.
test('budget API: authentication, ownership, calculations, editing, duplication and archives', async () => {
  const engine = new PGlite();
  const adapter = {
    query: (...args) => engine.query(...args),
    connect: async () => ({ query: (...args) => engine.query(...args), release() {} }),
  };
  const secret = 'test-secret-only-abcdefghijklmnopqrstuvwxyz';
  const user = '10000000-0000-4000-8000-000000000001',
    other = '10000000-0000-4000-8000-000000000002';
  const sid = '20000000-0000-4000-8000-000000000001',
    sid2 = '20000000-0000-4000-8000-000000000002';
  const trip = '30000000-0000-4000-8000-000000000001',
    expense = '40000000-0000-4000-8000-000000000001',
    booking = '50000000-0000-4000-8000-000000000001';
  try {
    for (const file of ['development.sql', 'budget.sql'])
      await engine.exec(
        await readFile(new URL('../database/' + file, import.meta.url), 'utf8'),
      );
    await engine.query('INSERT INTO users VALUES($1,$2),($3,$4)', [
      user,
      'Owner',
      other,
      'Other',
    ]);
    await engine.query(
      "INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 day'),($3,$4,now()+interval '1 day')",
      [sid, user, sid2, other],
    );
    await engine.query(
      "INSERT INTO trips VALUES($1,$2,'Test trip',160000,'EUR','active')",
      [trip, user],
    );
    const app = createApp(adapter, { secret });
    const token = (sub, session) =>
      jwt.sign({ sid: session }, secret, {
        subject: sub,
        issuer: 'tripnest',
        audience: 'tripnest-web',
        expiresIn: '1h',
      });
    const ownerToken = token(user, sid),
      otherToken = token(other, sid2);
    const api = (method, path, body, auth = ownerToken) =>
      request(app)
        [method]('/api/trips/' + trip + path)
        .set('Authorization', 'Bearer ' + auth)
        .send(body);
    await request(app)
      .get('/api/trips/' + trip + '/budget')
      .expect(401);
    await api('get', '/budget', undefined, otherToken).expect(404);
    await request(app).get('/api/dev/session').expect(401);
    await api('patch', '/budget', { budgetMinor: 160000, reserveMinor: 15000 }).expect(
      200,
    );
    const data = { id: expense, label: 'Food', amountMinor: 18000, category: 'Food' };
    await api('post', '/expenses', { ...data, amountMinor: -1 }).expect(400);
    let res = await api('post', '/expenses', data).expect(200);
    assert.equal(res.body.remainingMinor, 127000);
    await api('post', '/expenses', data).expect(409);
    await api(
      'patch',
      '/expenses/' + expense,
      { ...data, amountMinor: 20000 },
      otherToken,
    ).expect(404);
    res = await api('patch', '/expenses/' + expense, {
      ...data,
      amountMinor: 20000,
    }).expect(200);
    assert.equal(res.body.expensesMinor, 20000);
    await engine.query('INSERT INTO bookings VALUES($1,$2,54000,4000)', [booking, trip]);
    res = await api('patch', '/expenses/' + expense, {
      ...data,
      coveredByBookingId: booking,
    }).expect(200);
    assert.equal(res.body.bookedNetMinor, 50000);
    assert.equal(res.body.expensesMinor, 0);
    assert.equal(res.body.remainingMinor, 95000);
    await api('delete', '/expenses/' + expense).expect(200);
    await api('delete', '/expenses/' + expense).expect(404);
    await engine.query('INSERT INTO bookings VALUES($1,$2,18000,0)', [
      '50000000-0000-4000-8000-000000000002',
      trip,
    ]);
    await engine.query('UPDATE bookings SET refunded_minor=0 WHERE id=$1', [booking]);
    await api('post', '/expenses', {
      label: 'Food estimate',
      amountMinor: 18000,
      category: 'Food',
    }).expect(200);
    res = await api('post', '/expenses', {
      label: 'Extra transport',
      amountMinor: 7000,
      category: 'Transport',
    }).expect(200);
    assert.equal(res.body.totalMinor, 112000);
    assert.equal(res.body.remainingMinor, 48000);
    assert.equal(res.body.bookings.length, 2);
    const proposal = {
      expectedTotalMinor: 112000,
      expectedExpenseCount: 2,
      expenses: [
        {
          id: '60000000-0000-4000-8000-000000000001',
          label: 'Assistant extra activity',
          category: 'Activities',
          amountMinor: 5000,
        },
        {
          id: '60000000-0000-4000-8000-000000000002',
          label: 'Assistant other expenses',
          category: 'Other',
          amountMinor: 3000,
        },
      ],
    };
    await api('post', '/estimate-import', proposal, otherToken).expect(404);
    await api('post', '/estimate-import', { ...proposal, expectedTotalMinor: 0 }).expect(
      409,
    );
    await api('post', '/estimate-import', {
      ...proposal,
      expenses: [proposal.expenses[0], { ...proposal.expenses[1], amountMinor: -1 }],
    }).expect(400);
    assert.equal((await api('get', '/budget').expect(200)).body.expenses.length, 2);
    res = await api('post', '/estimate-import', proposal).expect(200);
    assert.equal(res.body.totalMinor, 120000);
    assert.equal(res.body.expenses.length, 4);
    res = await api('post', '/estimate-import', proposal).expect(200);
    assert.equal(res.body.totalMinor, 120000);
    assert.equal(res.body.expenses.length, 4);
    await api('post', '/estimate-import', {
      ...proposal,
      expenses: [{ ...proposal.expenses[0], amountMinor: 1 }, proposal.expenses[1]],
    }).expect(409);
    await engine.exec(
      "ALTER TABLE bookings ADD COLUMN status text DEFAULT 'confirmed'; ALTER TABLE bookings ADD COLUMN service_name text; ALTER TABLE bookings ADD COLUMN reference text;",
    );
    await engine.query(
      "UPDATE bookings SET service_name='Test hotel', reference='TN-TEST' WHERE id=$1",
      [booking],
    );
    const linked = {
      id: expense,
      label: 'Hotel estimate',
      amountMinor: 50000,
      category: 'Accommodation',
      coveredByBookingId: booking,
    };
    res = await api('post', '/expenses', linked).expect(200);
    assert.equal(res.body.totalMinor, 120000);
    assert.equal(
      res.body.bookings.find((b) => b.id === booking).serviceName,
      'Test hotel',
    );
    assert.equal(res.body.bookings.find((b) => b.id === booking).reference, 'TN-TEST');
    await engine.query(
      "UPDATE bookings SET status='cancelled',refunded_minor=53000 WHERE id=$1",
      [booking],
    );
    res = await api('get', '/budget').expect(200);
    assert.equal(res.body.bookedNetMinor, 19000);
    assert.equal(res.body.totalMinor, 117000);
    const restored = res.body.expenses.find((e) => e.id === expense);
    assert.equal(restored.coveredByBookingId, null);
    assert.equal(restored.bookingCancelled, true);
    await api('patch', '/expenses/' + expense, linked).expect(400);
    await engine.query("UPDATE trips SET status='archived' WHERE id=$1", [trip]);
    await api('post', '/expenses', data).expect(409);
    await api('post', '/estimate-import', proposal).expect(409);
    await engine.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [sid]);
    await api('get', '/budget').expect(401);
  } finally {
    await engine.close();
  }
});
