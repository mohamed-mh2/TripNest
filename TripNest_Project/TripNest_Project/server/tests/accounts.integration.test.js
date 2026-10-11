import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { addDays, todayString } from '../src/utils/dates.js';

test(
  'real PostgreSQL account and trip workflow integrates all four students without sharing user data',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const schema = 'account_test_' + randomUUID().replaceAll('-', '');
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      options: '-c search_path=' + schema + ',public',
    });
    const secret = 'account-integration-test-secret-abcdefghijklmnopqrstuvwxyz';
    try {
      for (const file of [
        'development.sql',
        'budget.sql',
        'wallet.sql',
        'cash.sql',
        'family.sql',
        'bookings.sql',
        'booking-services.sql',
        'support.sql',
      ])
        await db.query(
          await readFile(new URL('../database/' + file, import.meta.url), 'utf8'),
        );
      const oldUser = randomUUID(),
        oldTrip = randomUUID();
      await db.query("INSERT INTO users(id,name) VALUES($1,'Existing traveler')", [
        oldUser,
      ]);
      await db.query(
        "INSERT INTO trips(id,owner_id,title,budget_minor,currency) VALUES($1,$2,'Existing trip',160000,'EUR')",
        [oldTrip, oldUser],
      );
      for (let n = 0; n < 2; n++)
        await db.query(
          await readFile(new URL('../database/accounts.sql', import.meta.url), 'utf8'),
        );
      assert.equal(
        (await db.query('SELECT budget_minor FROM trips WHERE id=$1', [oldTrip])).rows[0]
          .budget_minor,
        '160000',
      );
      const app = createApp(db, { secret });
      await request(app).get('/api/trips').expect(401);
      await request(app).post('/api/auth/register').send(null).expect(400);
      const password = 'local-test-only-' + randomUUID();
      const first = (
        await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test Traveler',
            email: ' Traveler@example.test ',
            password,
            role: 'admin',
            id: oldUser,
          })
          .expect(201)
      ).body;
      assert.equal(first.user.email, 'traveler@example.test');
      assert.equal(first.user.role, 'customer');
      assert.equal('password_hash' in first.user, false);
      assert.notEqual(first.user.id, oldUser);
      assert.notEqual(
        (await db.query('SELECT password_hash FROM users WHERE id=$1', [first.user.id]))
          .rows[0].password_hash,
        password,
      );
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Duplicate', email: 'TRAVELER@example.test', password })
        .expect(409);
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'traveler@example.test', password: 'incorrect-password' })
        .expect(401);
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'missing@example.test', password })
        .expect(401);
      const second = (
        await request(app)
          .post('/api/auth/register')
          .send({ name: 'Other Traveler', email: 'other@example.test', password })
          .expect(201)
      ).body;
      const call = (method, path, body, token = first.token) =>
        request(app)
          [method]('/api' + path)
          .set('Authorization', 'Bearer ' + token)
          .send(body);
      assert.equal(
        (await call('get', '/auth/me').expect(200)).body.user.id,
        first.user.id,
      );
      assert.deepEqual((await call('get', '/trips').expect(200)).body.trips, []);
      assert.equal((await call('get', '/wallet').expect(200)).body.balanceMinor, 0);
      const day = addDays(todayString(), 30);
      const input = {
        name: 'Barcelona adventure',
        destination: 'Barcelona',
        startDate: day,
        endDate: addDays(day, 7),
        travelerCount: 2,
        budgetAmount: 1500,
        notes: 'Trip estimate, not a deposit.',
      };
      const trip = (await call('post', '/trips', input).expect(201)).body.trip;
      assert.equal(trip.budget_amount, 1500);
      assert.equal(trip.start_date, day);
      const bookingTrip = (await call('get', '/bookings/session').expect(200)).body
        .trips[0];
      assert.equal(bookingTrip.startDate, day);
      assert.equal(bookingTrip.endDate, input.endDate);
      assert.equal(bookingTrip.travelerCount, 2);
      assert.equal(bookingTrip.datesConfigured, true);
      assert.equal(
        (await call('get', '/bookings/session').expect(200)).body.trips[0].id,
        trip.id,
      );
      await call('get', '/trips/' + trip.id, undefined, second.token).expect(404);
      await call('patch', '/trips/' + trip.id, { name: 'Stolen' }, second.token).expect(
        404,
      );
      await call('delete', '/trips/' + trip.id, undefined, second.token).expect(404);
      await call('get', '/trips/invalid').expect(400);
      await call('post', '/trips', { ...input, budgetAmount: 1000001 }).expect(400);
      await call('post', '/trips', { ...input, startDate: '2035-02-30' }).expect(400);
      await call('patch', '/trips/' + trip.id, { startDate: addDays(day, 8) }).expect(
        400,
      );
      await call('patch', '/trips/' + trip.id, {
        startDate: null,
        notes: 'Changed notes',
        budgetAmount: 1700,
      }).expect(200);
      await call('patch', '/trips/' + trip.id, { startDate: day }).expect(200);
      assert.equal(
        (await call('get', '/trips/' + trip.id + '/budget').expect(200)).body.budgetMinor,
        170000,
      );
      await call('patch', '/trips/' + trip.id + '/budget', {
        budgetMinor: 180000,
        reserveMinor: 10000,
      }).expect(200);
      assert.equal(
        (await call('get', '/trips/' + trip.id).expect(200)).body.trip.budget_amount,
        1800,
      );
      const topupKey = randomUUID();
      for (let n = 0; n < 2; n++)
        await call('post', '/wallet/topups', { amountMinor: 5000 })
          .set('Idempotency-Key', topupKey)
          .expect(200);
      assert.equal((await call('get', '/wallet').expect(200)).body.balanceMinor, 5000);
      assert.equal(
        (await call('get', '/wallet', undefined, second.token).expect(200)).body
          .balanceMinor,
        0,
      );
      const service = (
        await db.query(
          "SELECT * FROM services WHERE category='flight' ORDER BY id LIMIT 1",
        )
      ).rows[0];
      const selection = { date: day, travelers: 2 };
      const quote = (
        await call('post', '/services/' + service.id + '/quote', { selection }).expect(
          200,
        )
      ).body.quote;
      const booking = (
        await call('post', '/bookings', {
          tripId: trip.id,
          serviceId: service.id,
          selection,
          paymentCardId: 'demo_card_approve',
          idempotencyKey: randomUUID(),
          expectedTotalMinor: quote.totalMinor,
        }).expect(201)
      ).body.booking;
      assert.equal(
        (await call('get', '/trips/' + trip.id + '/budget').expect(200)).body
          .bookedNetMinor,
        quote.totalMinor,
      );
      assert.equal(
        (await call('get', '/bookings', undefined, second.token).expect(200)).body
          .bookings.length,
        0,
      );
      await call('get', '/help/readiness/' + trip.id).expect(200);
      await call('get', '/help/readiness/' + trip.id, undefined, second.token).expect(
        404,
      );
      await call('get', '/help/admin/tickets').set('x-role', 'admin').expect(403);
      await call('delete', '/trips/' + trip.id).expect(200);
      assert.equal(
        (await call('get', '/bookings/session').expect(200)).body.trips.length,
        0,
      );
      await call('patch', '/trips/' + trip.id, { name: 'Archived edit' }).expect(409);
      assert.equal(
        (await call('get', '/bookings/' + booking.id).expect(200)).body.booking.id,
        booking.id,
      );
      await call('post', '/trips/' + trip.id + '/restore').expect(200);
      assert.equal(
        (await call('get', '/bookings/session').expect(200)).body.trips[0].id,
        trip.id,
      );
      const claims = jwt.decode(first.token);
      const expired = jwt.sign({ sid: claims.sid }, secret, {
        subject: first.user.id,
        issuer: 'tripnest',
        audience: 'tripnest-web',
        expiresIn: -1,
      });
      await call('get', '/wallet', undefined, expired).expect(401);
      await call('post', '/auth/logout').expect(204);
      await call('get', '/auth/me').expect(401);
      await call('get', '/wallet').expect(401);
      await call('get', '/bookings').expect(401);
      const login = (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'TRAVELER@example.test', password })
          .expect(200)
      ).body;
      assert.equal(
        (await call('get', '/wallet', undefined, login.token).expect(200)).body
          .balanceMinor,
        5000,
      );
      assert.equal(
        (await call('get', '/trips', undefined, login.token).expect(200)).body.trips
          .length,
        1,
      );
    } finally {
      await db.end();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    }
  },
);
