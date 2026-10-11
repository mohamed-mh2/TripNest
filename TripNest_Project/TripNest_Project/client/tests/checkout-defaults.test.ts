import test from 'node:test';
import assert from 'node:assert/strict';
import { prefillForTrip } from '../src/features/bookings/selectionDefaults.ts';
import type { TravelService, TripSummary } from '../../shared/types';

const form = {
  date: '',
  checkIn: '',
  checkOut: '',
  travelers: '1',
  rooms: '1',
  guests: '1',
  quantity: '1',
};
const trip = {
  startDate: '2035-05-01',
  endDate: '2035-05-07',
  travelerCount: 2,
  datesConfigured: true,
} as TripSummary;
const service = { category: 'flight', attributes: {} } as TravelService;
test('checkout uses trip dates and travelers, including hotel room capacity and full stay', () => {
  const flight = prefillForTrip(service, form, trip, '2035-04-01');
  assert.equal(flight.travelers, '2');
  assert.equal(flight.date, '2035-05-01');
  const hotel = prefillForTrip(
    { ...service, category: 'hotel', attributes: { maxGuestsPerRoom: 2 } },
    form,
    { ...trip, travelerCount: 3 },
    '2035-04-01',
  );
  assert.equal(hotel.rooms, '2');
  assert.equal(hotel.guests, '3');
  assert.equal(hotel.checkOut, '2035-05-07');
});
test('an undated trip does not fabricate travel dates or a hotel stay', () => {
  const undated = { ...trip, datesConfigured: false };
  assert.equal(prefillForTrip(service, form, undated).date, '');
  const hotel = prefillForTrip({ ...service, category: 'hotel' }, form, undated);
  assert.equal(hotel.checkIn, '');
  assert.equal(hotel.checkOut, '');
});
