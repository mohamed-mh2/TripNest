// Behavior, ownership, and calculation tests for travel services and bookings. المسؤول: abed alrahman.
// #explain_notes: Runs the real Express app against pg-mem (in-memory PostgreSQL emulator).
// Run with: npm test

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { newDb } = require('pg-mem');

const db = require('../server/src/db');
const { setupDatabase } = require('../server/database/setup');
const { createApp } = require('../server/src/app');
const { addDays, todayString } = require('../server/src/utils/dates');
const { calculateRefund } = require('../server/src/utils/cancellationPolicy');


let server;
let baseUrl;
let pool;

const today = todayString();
const tripStart = addDays(today, 20);
const tripEnd = addDays(today, 27);

const ids = {
  lina: null,
  omar: null,
  linaTrip: null,
  linaOtherTrip: null,
  omarTrip: null,
};

let keyCounter = 0;


function newKey() {
  keyCounter += 1;
  return `test-key-${Date.now()}-${keyCounter}`;
}


async function api(method, path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (options.user) {
    headers['X-Demo-User'] = String(options.user);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}


async function serviceIdByName(name) {
  const { rows } = await pool.query('SELECT id FROM services WHERE name = $1', [name]);
  return rows[0].id;
}


async function countBookings() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM bookings');
  return rows[0].count;
}


before(async () => {
  const memoryDb = newDb();
  const { Pool } = memoryDb.adapters.createPg();

  pool = new Pool();
  db.setPool(pool);
  await setupDatabase(pool);

  const users = await pool.query('SELECT id, email FROM users ORDER BY id');
  ids.lina = users.rows.find((user) => user.email.startsWith('lina')).id;
  ids.omar = users.rows.find((user) => user.email.startsWith('omar')).id;

  // #explain_notes: Tests use their own trips with dates relative to today.
  const insertTrip = async (userId, title, start, end) => {
    const { rows } = await pool.query(
      `INSERT INTO trips (user_id, title, destination_city, currency, start_date, end_date)
       VALUES ($1, $2, 'Barcelona', 'EUR', $3, $4) RETURNING id`,
      [userId, title, start, end],
    );
    return rows[0].id;
  };

  ids.linaTrip = await insertTrip(ids.lina, 'Test trip Lina', tripStart, tripEnd);
  ids.linaOtherTrip = await insertTrip(ids.lina, 'Second test trip Lina', tripStart, tripEnd);
  ids.omarTrip = await insertTrip(ids.omar, 'Test trip Omar', tripStart, tripEnd);

  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});


after(() => {
  server.close();
});


describe('service catalog search, filters, and sorting', () => {
  test('lists all seven categories of demo services', async () => {
    const { status, body } = await api('GET', '/services');

    assert.equal(status, 200);
    assert.equal(new Set(body.services.map((service) => service.category)).size, 7);
    assert.ok(body.services.every((service) => service.isDemo));
  });

  test('filters by category and searches by text', async () => {
    const hotels = await api('GET', '/services?category=hotel');
    assert.ok(hotels.body.services.length >= 4);
    assert.ok(hotels.body.services.every((service) => service.category === 'hotel'));

    const madrid = await api('GET', '/services?category=train&q=madrid');
    assert.ok(madrid.body.services.length >= 2);
    assert.ok(madrid.body.services.every((service) => service.name.toLowerCase().includes('madrid')));
  });

  test('filters by route, stars, data, and price', async () => {
    const fromMadrid = await api('GET', '/services?category=flight&origin=Madrid');
    assert.ok(fromMadrid.body.services.every((service) => service.attributes.origin === 'Madrid'));

    const fourStars = await api('GET', '/services?category=hotel&minStars=4');
    assert.ok(fourStars.body.services.length >= 2);
    assert.ok(fourStars.body.services.every((service) => service.attributes.stars >= 4));

    const bigData = await api('GET', '/services?category=esim&minDataGb=15');
    assert.ok(bigData.body.services.every((service) => service.attributes.dataGb === null || service.attributes.dataGb >= 15));
    assert.ok(bigData.body.services.some((service) => service.attributes.dataGb === null));

    const cheap = await api('GET', '/services?maxPriceMinor=2000');
    assert.ok(cheap.body.services.length > 0);
    assert.ok(cheap.body.services.every((service) => service.unitPriceMinor <= 2000));
  });

  test('sorts by price in both directions', async () => {
    const ascending = await api('GET', '/services?category=activity&sort=price_asc');
    const prices = ascending.body.services.map((service) => service.unitPriceMinor);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

    const descending = await api('GET', '/services?category=activity&sort=price_desc');
    assert.deepEqual(descending.body.services.map((service) => service.unitPriceMinor), [...prices].sort((a, b) => b - a));
  });

  test('rejects unknown filters and treats search text literally', async () => {
    assert.equal((await api('GET', '/services?category=spaceship')).status, 400);
    assert.equal((await api('GET', '/services?sort=random')).status, 400);

    const percent = await api('GET', '/services?q=%25');
    assert.equal(percent.status, 200);
    assert.equal(percent.body.services.length, 0);
  });

  test('returns route facets and 404 for unknown services', async () => {
    const facets = await api('GET', '/services/facets?category=flight');
    assert.ok(facets.body.origins.includes('Madrid'));

    assert.equal((await api('GET', '/services/999999')).status, 404);
    assert.equal((await api('GET', '/services/abc')).status, 404);
  });
});


describe('category-specific price calculation', () => {
  test('hotel: rooms x nights plus tourist tax per guest-night', async () => {
    const serviceId = await serviceIdByName('Casa Gothic Boutique Hotel');
    const { status, body } = await api('POST', `/services/${serviceId}/quote`, {
      body: { selection: { checkIn: tripStart, checkOut: addDays(tripStart, 3), rooms: 2, guests: 3 } },
    });

    assert.equal(status, 200);
    assert.equal(body.quote.nights, 3);
    assert.equal(body.quote.subtotalMinor, 14500 * 2 * 3);
    assert.equal(body.quote.taxesMinor, 375 * 3 * 3);
    assert.equal(body.quote.totalMinor, 87000 + 3375);
  });

  test('flight: price per traveler plus booking fee', async () => {
    const serviceId = await serviceIdByName('Madrid to Barcelona morning flight');
    const { body } = await api('POST', `/services/${serviceId}/quote`, {
      body: { selection: { date: tripStart, travelers: 2 } },
    });

    assert.equal(body.quote.totalMinor, 6900 * 2 + 300);
    assert.equal(body.quote.feesMinor, 300);
  });

  test('transfer: private car is priced per vehicle', async () => {
    const serviceId = await serviceIdByName('Airport to city private car');
    const { body } = await api('POST', `/services/${serviceId}/quote`, {
      body: { selection: { date: tripStart, travelers: 5 } },
    });

    assert.equal(body.quote.billableUnits, 2);
    assert.equal(body.quote.totalMinor, 3900 * 2);
  });

  test('eSIM and activity: price per item and per ticket', async () => {
    const esimId = await serviceIdByName('Spain 5 GB for 7 days');
    const esim = await api('POST', `/services/${esimId}/quote`, {
      body: { selection: { date: tripStart, quantity: 3 } },
    });
    assert.equal(esim.body.quote.totalMinor, 799 * 3);

    const tourId = await serviceIdByName('Sagrada Familia guided tour');
    const tour = await api('POST', `/services/${tourId}/quote`, {
      body: { selection: { date: tripStart, quantity: 4 } },
    });
    assert.equal(tour.body.quote.totalMinor, 3900 * 4 + 150);
  });

  test('rejects invalid selections with field messages', async () => {
    const hotelId = await serviceIdByName('Casa Gothic Boutique Hotel');
    const backwards = await api('POST', `/services/${hotelId}/quote`, {
      body: { selection: { checkIn: tripStart, checkOut: tripStart, rooms: 1, guests: 1 } },
    });
    assert.equal(backwards.status, 422);
    assert.ok(backwards.body.error.fields.checkOut);

    const tooManyGuests = await api('POST', `/services/${hotelId}/quote`, {
      body: { selection: { checkIn: tripStart, checkOut: addDays(tripStart, 1), rooms: 1, guests: 3 } },
    });
    assert.ok(tooManyGuests.body.error.fields.guests);

    const flightId = await serviceIdByName('Madrid to Barcelona morning flight');
    const past = await api('POST', `/services/${flightId}/quote`, {
      body: { selection: { date: addDays(today, -1), travelers: 1 } },
    });
    assert.ok(past.body.error.fields.date);
  });
});


describe('booking, simulated payment, and duplicate protection', () => {
  test('requires a signed-in customer', async () => {
    assert.equal((await api('GET', '/bookings')).status, 401);
    assert.equal((await api('POST', '/bookings', { body: {} })).status, 401);
    assert.equal((await api('GET', '/bookings', { user: 999 })).status, 401);
  });

  test('successful payment creates one confirmed booking priced by the server', async () => {
    const serviceId = await serviceIdByName('Madrid to Barcelona high-speed train');
    const { status, body } = await api('POST', '/bookings', {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { date: tripStart, travelers: 2 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
        totalMinor: 1,
      },
    });

    assert.equal(status, 201);
    assert.equal(body.booking.status, 'confirmed');
    assert.match(body.booking.reference, /^TN-[A-Z0-9]{8}$/);
    assert.equal(body.booking.totalMinor, 6500 * 2);
    assert.equal(body.booking.refundedMinor, 0);
    assert.equal(body.booking.tripId, ids.linaTrip);
  });

  test('declined payment creates no booking, and retrying that key stays declined', async () => {
    const serviceId = await serviceIdByName('Sunset catamaran cruise');
    const before = await countBookings();
    const key = newKey();
    const request = {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { date: tripStart, quantity: 2 },
        paymentCardId: 'demo_card_decline',
        idempotencyKey: key,
      },
    };

    const first = await api('POST', '/bookings', request);
    assert.equal(first.status, 402);
    assert.equal(first.body.error.code, 'PAYMENT_DECLINED');

    const retry = await api('POST', '/bookings', request);
    assert.equal(retry.status, 402);
    assert.equal(await countBookings(), before);

    const { rows } = await pool.query('SELECT outcome, booking_id FROM booking_payment_attempts WHERE idempotency_key = $1', [key]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'declined');
    assert.equal(rows[0].booking_id, null);
  });

  test('retrying with the same key returns the original booking', async () => {
    const serviceId = await serviceIdByName('Spain 5 GB for 7 days');
    const request = {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { date: tripStart, quantity: 1 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
      },
    };

    const first = await api('POST', '/bookings', request);
    const before = await countBookings();
    const retry = await api('POST', '/bookings', request);

    assert.equal(retry.status, 200);
    assert.equal(retry.body.replayed, true);
    assert.equal(retry.body.booking.id, first.body.booking.id);
    assert.equal(await countBookings(), before);
  });

  test('rapid parallel clicks with one key create exactly one booking', async () => {
    const serviceId = await serviceIdByName('Gothic Quarter walking tour');
    const before = await countBookings();
    const request = {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { date: tripStart, quantity: 1 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
      },
    };

    const results = await Promise.all([1, 2, 3, 4, 5].map(() => api('POST', '/bookings', request)));

    assert.ok(results.every((result) => result.status === 201 || result.status === 200));
    assert.equal(new Set(results.map((result) => result.body.booking.id)).size, 1);
    assert.equal(await countBookings(), before + 1);
  });

  test('rejects dates outside the selected trip', async () => {
    const serviceId = await serviceIdByName('Madrid to Barcelona morning flight');
    const { status, body } = await api('POST', '/bookings', {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { date: addDays(tripEnd, 1), travelers: 1 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
      },
    });

    assert.equal(status, 422);
    assert.equal(body.error.code, 'OUTSIDE_TRIP_DATES');
  });

  test('blocks overbooking hotel rooms on overlapping nights', async () => {
    const serviceId = await serviceIdByName('Montjuic Garden Suites');
    const book = (rooms, checkIn, checkOut) => api('POST', '/bookings', {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { checkIn, checkOut, rooms, guests: rooms },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
      },
    });

    assert.equal((await book(4, tripStart, addDays(tripStart, 3))).status, 201);

    const overlapping = await book(2, addDays(tripStart, 2), addDays(tripStart, 4));
    assert.equal(overlapping.status, 409);
    assert.equal(overlapping.body.error.code, 'SOLD_OUT');

    assert.equal((await book(2, addDays(tripStart, 3), addDays(tripStart, 5))).status, 201);
  });
});


describe('ownership', () => {
  let linaBookingId;

  before(async () => {
    const serviceId = await serviceIdByName('Park Guell entry ticket');
    const { body } = await api('POST', '/bookings', {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { date: tripStart, quantity: 2 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
      },
    });
    linaBookingId = body.booking.id;
  });

  test('cannot book against another customer\'s trip', async () => {
    const serviceId = await serviceIdByName('Park Guell entry ticket');
    const { status } = await api('POST', '/bookings', {
      user: ids.omar,
      body: {
        serviceId,
        tripId: ids.linaTrip,
        selection: { date: tripStart, quantity: 1 },
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
      },
    });

    assert.equal(status, 404);
  });

  test('cannot view, list, or cancel another customer\'s booking', async () => {
    assert.equal((await api('GET', `/bookings/${linaBookingId}`, { user: ids.omar })).status, 404);
    assert.equal((await api('POST', `/bookings/${linaBookingId}/cancel`, { user: ids.omar })).status, 404);
    assert.equal((await api('GET', `/bookings/trips/${ids.linaTrip}/summary`, { user: ids.omar })).status, 404);

    const omarList = await api('GET', '/bookings', { user: ids.omar });
    assert.ok(omarList.body.bookings.every((booking) => booking.id !== linaBookingId));

    const stillMine = await api('GET', `/bookings/${linaBookingId}`, { user: ids.lina });
    assert.equal(stillMine.body.booking.status, 'confirmed');
  });
});


describe('cancellation and refunds', () => {
  async function bookFor(name, selection, tripId = ids.linaTrip) {
    const serviceId = await serviceIdByName(name);
    const { body } = await api('POST', '/bookings', {
      user: ids.lina,
      body: { serviceId, tripId, selection, paymentCardId: 'demo_card_approve', idempotencyKey: newKey() },
    });
    return body.booking;
  }

  test('free cancellation refunds everything except the booking fee, only once', async () => {
    const booking = await bookFor('Madrid to Barcelona morning flight', { date: tripStart, travelers: 2 });
    assert.equal(booking.cancellationPreview.refundMinor, 6900 * 2);

    const cancelled = await api('POST', `/bookings/${booking.id}/cancel`, { user: ids.lina });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.booking.status, 'cancelled');
    assert.equal(cancelled.body.refund.amountMinor, 6900 * 2);
    assert.equal(cancelled.body.booking.netMinor, 300);

    const again = await api('POST', `/bookings/${booking.id}/cancel`, { user: ids.lina });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'ALREADY_CANCELLED');

    const reloaded = await api('GET', `/bookings/${booking.id}`, { user: ids.lina });
    assert.equal(reloaded.body.booking.refundedMinor, 6900 * 2);
  });

  test('parallel cancellations refund only once', async () => {
    const booking = await bookFor('Barcelona to Palma overnight ferry', { date: tripStart, travelers: 1 });
    const results = await Promise.all([1, 2, 3].map(() => api('POST', `/bookings/${booking.id}/cancel`, { user: ids.lina })));

    assert.equal(results.filter((result) => result.status === 200).length, 1);

    const { rows } = await pool.query('SELECT refunded_minor FROM bookings WHERE id = $1', [booking.id]);
    assert.equal(rows[0].refunded_minor, 5500);
  });

  test('non-refundable booking cancels with zero refund', async () => {
    const booking = await bookFor('Flamenco night show', { date: tripStart, quantity: 2 });
    const cancelled = await api('POST', `/bookings/${booking.id}/cancel`, { user: ids.lina });

    assert.equal(cancelled.body.refund.amountMinor, 0);
    assert.equal(cancelled.body.booking.netMinor, booking.totalMinor);
  });

  test('late cancellation uses the partial refund percentage', () => {
    const startsAt = new Date('2030-01-10T16:00:00Z');
    const booking = {
      status: 'confirmed',
      starts_at: startsAt,
      total_minor: 10150,
      fees_minor: 150,
      free_cancel_hours: 24,
      late_refund_percent: 50,
    };

    const early = calculateRefund(booking, new Date('2030-01-09T15:00:00Z'));
    assert.equal(early.refundMinor, 10000);

    const late = calculateRefund(booking, new Date('2030-01-10T10:00:00Z'));
    assert.equal(late.refundMinor, 5000);

    const started = calculateRefund(booking, new Date('2030-01-10T16:00:00Z'));
    assert.equal(started.canCancel, false);
  });
});


describe('cost planner integration', () => {
  test('trip summary returns net cost = total - refunded, counted once per booking', async () => {
    const serviceId = await serviceIdByName('Eixample Design Rooms');
    const book = (selection) => api('POST', '/bookings', {
      user: ids.lina,
      body: {
        serviceId,
        tripId: ids.linaOtherTrip,
        selection,
        paymentCardId: 'demo_card_approve',
        idempotencyKey: newKey(),
      },
    });

    const kept = await book({ checkIn: tripStart, checkOut: addDays(tripStart, 2), rooms: 1, guests: 2 });
    const toCancel = await book({ checkIn: addDays(tripStart, 3), checkOut: addDays(tripStart, 4), rooms: 1, guests: 1 });
    await api('POST', `/bookings/${toCancel.body.booking.id}/cancel`, { user: ids.lina });

    const summary = await api('GET', `/bookings/trips/${ids.linaOtherTrip}/summary`, { user: ids.lina });
    const list = await api('GET', `/bookings?tripId=${ids.linaOtherTrip}`, { user: ids.lina });

    const expectedNet = list.body.bookings.reduce((sum, booking) => sum + booking.totalMinor - booking.refundedMinor, 0);

    assert.equal(summary.status, 200);
    assert.equal(summary.body.bookingCount, 2);
    assert.equal(summary.body.netMinor, expectedNet);
    assert.equal(summary.body.netMinor, kept.body.booking.totalMinor);
    assert.equal(summary.body.bookedTotalMinor - summary.body.refundedMinor, summary.body.netMinor);
  });
});
