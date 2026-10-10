import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrip, validDate } from '../src/tripValidation.js';
test('trip validation rejects impossible dates and reversed ranges', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.ok(
    validateTrip({
      name: 'Holiday',
      destination: 'Rome',
      startDate: '2026-12-20',
      endDate: '2026-12-10',
    }).errors.endDate,
  );
});
test('trip validation requires traveler count and planned budget', () => {
  const base = { name: 'Rome break', destination: 'Rome' };
  assert.ok(validateTrip(base).errors.travelerCount);
  assert.ok(validateTrip(base).errors.budgetAmount);
  assert.deepEqual(
    validateTrip({ ...base, travelerCount: 2, budgetAmount: 1200.5 }).errors,
    {},
  );
  assert.ok(
    validateTrip({ ...base, travelerCount: 0, budgetAmount: -1 }).errors.travelerCount,
  );
  assert.ok(
    validateTrip({ ...base, travelerCount: 21, budgetAmount: 1.234 }).errors.budgetAmount,
  );
});
