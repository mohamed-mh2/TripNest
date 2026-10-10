import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { calculateQuote } from '../src/utils/bookingPricing.js';
import { calculateRefund } from '../src/utils/cancellationPolicy.js';
import { addDays, todayString } from '../src/utils/dates.js';

test('category-specific hotel/transfer quantities and cancellation arithmetic', () => {
  const now = new Date('2035-01-01T12:00:00Z');
  const hotel = {
    id: 1,
    category: 'hotel',
    price_unit: 'per_room_night',
    unit_price_minor: 9800,
    booking_fee_minor: 100,
    free_cancel_hours: 24,
    late_refund_percent: 50,
    currency: 'EUR',
    attributes: { maxGuestsPerRoom: 3, touristTaxPerGuestNightMinor: 275 },
  };
  const result = calculateQuote(
    hotel,
    { checkIn: '2035-01-10', checkOut: '2035-01-13', rooms: 2, guests: 4 },
    now,
  );
  assert.equal(result.quote.totalMinor, 62200);
  assert.equal(result.quote.capacityUnits, 2);
  assert.ok(
    calculateQuote(
      hotel,
      { checkIn: '2035-01-10', checkOut: '2035-01-10', rooms: 1, guests: 4 },
      now,
    ).errors,
  );
  const transfer = calculateQuote(
    {
      ...hotel,
      category: 'transfer',
      price_unit: 'per_vehicle',
      unit_price_minor: 3900,
      booking_fee_minor: 0,
      attributes: { vehicleCapacity: 3 },
    },
    { date: '2035-01-10', travelers: 5 },
    now,
  );
  assert.equal(transfer.quote.totalMinor, 7800);
  const booking = {
    status: 'confirmed',
    starts_at: '2035-01-10T12:00:00Z',
    total_minor: 14100,
    fees_minor: 300,
    free_cancel_hours: 48,
    late_refund_percent: 50,
  };
  assert.equal(calculateRefund(booking, now).refundMinor, 13800);
  assert.equal(
    calculateRefund(booking, new Date('2035-01-10T00:00:00Z')).refundMinor,
    6900,
  );
});

// #explain_notes: A temporary PostgreSQL schema verifies real locks and rollback; customer data is untouched.
test(
  'real PostgreSQL integration: ownership, price review, retries, capacity, refunds and budget',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const schema = 'booking_test_' + randomUUID().replaceAll('-', '');
    await admin.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      options: '-c search_path=' + schema + ',public',
    });
    const secret = 'bookings-integration-test-secret-abcdefghijklmnopqrstuvwxyz';
    const user = randomUUID(),
      other = randomUUID(),
      sid = randomUUID(),
      otherSid = randomUUID();
    const trip = randomUUID(),
      otherTrip = randomUUID();
    const day = addDays(todayString(), 30);
    try {
      for (const file of [
        'development.sql',
        'budget.sql',
        'wallet.sql',
        'cash.sql',
        'family.sql',
      ])
        await db.query(
          await readFile(new URL('../database/' + file, import.meta.url), 'utf8'),
        );
      await db.query('INSERT INTO users(id,name) VALUES($1,$2),($3,$4)', [
        user,
        'Booking owner',
        other,
        'Other owner',
      ]);
      await db.query(
        "INSERT INTO trips(id,owner_id,title,budget_minor,currency) VALUES($1,$2,'Test trip',160000,'EUR'),($3,$4,'Other trip',160000,'EUR')",
        [trip, user, otherTrip, other],
      );
      const legacyId = randomUUID();
      await db.query(
        'INSERT INTO bookings(id,trip_id,total_minor,refunded_minor) VALUES($1,$2,1000,250)',
        [legacyId, trip],
      );
      for (let n = 0; n < 2; n++)
        await db.query(
          await readFile(new URL('../database/bookings.sql', import.meta.url), 'utf8'),
        );
      await db.query(
        await readFile(
          new URL('../database/booking-services.sql', import.meta.url),
          'utf8',
        ),
      );
      assert.equal(
        (await db.query('SELECT total_minor FROM bookings WHERE id=$1', [legacyId]))
          .rows[0].total_minor,
        '1000',
      );
      await db.query('UPDATE trips SET start_date=$1,end_date=$2', [
        day,
        addDays(day, 8),
      ]);
      await db.query(
        "INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 day'),($3,$4,now()+interval '1 day')",
        [sid, user, otherSid, other],
      );
      const token = (sub, session) =>
        jwt.sign({ sid: session }, secret, {
          subject: sub,
          issuer: 'tripnest',
          audience: 'tripnest-web',
          expiresIn: '1h',
        });
      const app = createApp(db, { secret });
      const call = (method, path, body, auth = token(user, sid)) =>
        request(app)
          [method]('/api' + path)
          .set('Authorization', 'Bearer ' + auth)
          .send(body);
      await request(app).get('/api/bookings').expect(401);
      await request(app).get('/api/bookings').set('X-Demo-User', user).expect(401);
      assert.equal(
        (await call('get', '/bookings/session').expect(200)).body.trips[0].id,
        trip,
      );
      const all = await call('get', '/services').expect(200);
      assert.equal(all.body.services.length, 29);
      const service = all.body.services.find(
        (s) => s.name === 'Madrid to Barcelona morning flight',
      );
      const hotel = all.body.services.find((s) => s.name === 'Eixample Design Rooms');
      const shuttle = all.body.services.find((s) => s.name === 'Airport shuttle bus');
      const filtered = await call(
        'get',
        '/services?category=flight&origin=Madrid&maxPriceMinor=7000',
      ).expect(200);
      assert.equal(filtered.body.services.length, 1);
      await call('get', '/services?minRating=bad').expect(400);
      await call('get', '/services/facets?category=hotel').expect(200);
      await call('get', '/services/invalid').expect(404);
      const hotelQuote = await call('post', '/services/' + hotel.id + '/quote', {
        selection: { checkIn: day, checkOut: addDays(day, 3), rooms: 2, guests: 4 },
      }).expect(200);
      assert.equal(hotelQuote.body.quote.totalMinor, 62100);
      const intent = {
        serviceId: service.id,
        tripId: trip,
        selection: { date: day, travelers: 2 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: randomUUID(),
        expectedTotalMinor: 14100,
      };
      await call('post', '/bookings', { ...intent, tripId: otherTrip }).expect(404);
      await call('post', '/bookings', { ...intent, expectedTotalMinor: 1 }).expect(409);
      await call('post', '/bookings', {
        ...intent,
        selection: { date: addDays(day, -1), travelers: 2 },
      }).expect(422);
      const decline = {
        ...intent,
        paymentCardId: 'demo_card_decline',
        idempotencyKey: randomUUID(),
      };
      await call('post', '/bookings', decline).expect(402);
      await call('post', '/bookings', decline).expect(402);
      assert.equal((await call('get', '/bookings').expect(200)).body.bookings.length, 0);
      const outcomes = await Promise.all([
        call('post', '/bookings', intent),
        call('post', '/bookings', intent),
      ]);
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 201]);
      assert.equal(outcomes[0].body.booking.id, outcomes[1].body.booking.id);
      const booking = outcomes[0].body.booking;
      assert.equal(booking.totalMinor, 14100);
      await call('post', '/bookings', {
        ...intent,
        selection: { date: day, travelers: 1 },
        expectedTotalMinor: 7200,
      }).expect(409);
      await call(
        'get',
        '/bookings/' + booking.id,
        undefined,
        token(other, otherSid),
      ).expect(404);
      await call(
        'post',
        '/bookings/' + booking.id + '/cancel',
        undefined,
        token(other, otherSid),
      ).expect(404);
      await call(
        'get',
        '/bookings/trips/' + trip + '/summary',
        undefined,
        token(other, otherSid),
      ).expect(404);
      let budget = await call('get', '/trips/' + trip + '/budget').expect(200);
      assert.equal(budget.body.bookedNetMinor, 14850);
      await call('post', '/trips/' + trip + '/expenses', {
        label: 'Flight estimate',
        amountMinor: 14100,
        category: 'Transport',
        coveredByBookingId: booking.id,
      }).expect(200);
      budget = await call('get', '/trips/' + trip + '/budget').expect(200);
      assert.equal(budget.body.expensesMinor, 0);
      const refunds = await Promise.all([
        call('post', '/bookings/' + booking.id + '/cancel'),
        call('post', '/bookings/' + booking.id + '/cancel'),
      ]);
      assert.deepEqual(refunds.map((r) => r.status).sort(), [200, 409]);
      assert.equal(refunds.find((r) => r.status === 200).body.refund.amountMinor, 13800);
      budget = await call('get', '/trips/' + trip + '/budget').expect(200);
      assert.equal(budget.body.bookedNetMinor, 1050);
      assert.equal(
        (await call('get', '/bookings/trips/' + trip + '/summary').expect(200)).body
          .netMinor,
        1050,
      );
      assert.equal(
        (await call('get', '/bookings?status=cancelled&tripId=' + trip).expect(200)).body
          .bookings.length,
        1,
      );
      await db.query('UPDATE services SET daily_capacity=1 WHERE id=$1', [shuttle.id]);
      const one = {
        serviceId: shuttle.id,
        tripId: trip,
        selection: { date: day, travelers: 1 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: randomUUID(),
        expectedTotalMinor: 690,
      };
      const two = { ...one, idempotencyKey: randomUUID() };
      const competing = await Promise.all([
        call('post', '/bookings', one),
        call('post', '/bookings', two),
      ]);
      assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
      await call('post', '/bookings', competing[0].status === 201 ? one : two).expect(
        200,
      );
      const before = Number(
        (await db.query('SELECT count(*) FROM bookings')).rows[0].count,
      );
      // The second write fails: PostgreSQL must roll back the first booking insert.
      await db.query(
        "ALTER TABLE booking_payment_attempts ADD CONSTRAINT test_reject_payment CHECK(card_label <> 'TripNest Demo Visa ending 4242') NOT VALID",
      );
      await call('post', '/bookings', { ...intent, idempotencyKey: randomUUID() }).expect(
        500,
      );
      assert.equal(
        Number((await db.query('SELECT count(*) FROM bookings')).rows[0].count),
        before,
      );
      await db.query(
        'ALTER TABLE booking_payment_attempts DROP CONSTRAINT test_reject_payment',
      );
      await db.query("UPDATE trips SET status='archived' WHERE id=$1", [trip]);
      await call('post', '/bookings', { ...intent, idempotencyKey: randomUUID() }).expect(
        409,
      );
      for (const table of ['wallet_entries', 'family_requests', 'cash_vouchers'])
        assert.equal(
          Number((await db.query('SELECT count(*) FROM ' + table)).rows[0].count),
          0,
        );
      await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [sid]);
      await call('get', '/bookings').expect(401);
    } finally {
      await db.end();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    }
  },
);
