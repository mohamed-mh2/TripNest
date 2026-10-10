import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePendingBooking } from '../src/features/bookings/pendingCheckout.ts';

test('booking recovery retains the reviewed price and original request key across serialization', () => {
  const body = {
    serviceId: 1,
    tripId: '30000000-0000-4000-8000-000000000001',
    selection: { date: '2035-01-10', travelers: 2 },
    paymentCardId: 'demo_card_approve',
    idempotencyKey: '60000000-0000-4000-8000-000000000001',
    expectedTotalMinor: 14100,
  };
  assert.deepEqual(decodePendingBooking(JSON.stringify(body)), body);
  assert.equal(decodePendingBooking('{bad json'), null);
  assert.equal(
    decodePendingBooking(JSON.stringify({ ...body, expectedTotalMinor: -1 })),
    null,
  );
  assert.equal(decodePendingBooking(JSON.stringify({ ...body, selection: [] })), null);
  assert.equal(decodePendingBooking(JSON.stringify({ ...body, tripId: 1 })), null);
});
