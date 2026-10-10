import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTrip,
  exampleRanges,
  triangular,
  type CostRange,
} from '../src/features/assistant/estimate.ts';
import { emptyBudget } from '../src/features/budget/model.ts';

const trip = { destination: 'Test city', days: 3, nights: 2, travelers: 2, rooms: 1 };
const cost = (unit: CostRange['unit']): CostRange => ({
  id: unit,
  label: unit,
  category: 'Other',
  unit,
  low: 1000,
  likely: 1000,
  high: 1000,
  include: true,
});

test('assistant counts people, days and room nights and includes the saved plan once', () => {
  const plan = {
    ...emptyBudget,
    reserveInCents: 5000,
    bookedNetInCents: 10000,
    expenses: [
      { id: 'food', name: 'Food', category: 'Food' as const, amountInCents: 3000 },
      {
        id: 'covered',
        name: 'Hotel already booked',
        category: 'Accommodation' as const,
        amountInCents: 10000,
        coveredByBookingId: 'booking',
      },
    ],
  };
  const result = estimateTrip(
    trip,
    [cost('person'), cost('person-day'), cost('room-night')],
    plan,
  );
  assert.equal(result.fixed, 18000);
  assert.equal(result.expected, 28000);
  assert.equal(result.p10, 28000);
  assert.equal(result.p90, 28000);
  assert.equal(result.chanceWithinBudget, 100);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].amountInCents, 10000);
  assert.equal(
    result.histogram.reduce((n, b) => n + b.count, 0),
    4000,
  );
  const defaults = exampleRanges(plan);
  assert.ok(
    defaults
      .filter((r) => ['Food', 'Accommodation'].includes(r.category))
      .every((r) => !r.include),
  );
  assert.equal(defaults.find((r) => r.id === 'travel')?.include, false);
});

test('probabilities are repeatable and quantiles respect the entered range', () => {
  const range = { ...cost('person'), low: 10000, likely: 20000, high: 30000 };
  const plan = { ...emptyBudget, budgetInCents: 40000 };
  const a = estimateTrip(trip, [range], plan),
    b = estimateTrip(trip, [range], plan);
  assert.deepEqual(a, b);
  assert.equal(a.expected, 40000);
  assert.ok(a.p10 >= 20000 && a.p10 < a.p50 && a.p50 < a.p90 && a.p90 <= 60000);
  assert.ok(a.chanceWithinBudget >= 47 && a.chanceWithinBudget <= 53);
  assert.equal(triangular(10, 20, 30, 0), 10);
  assert.equal(triangular(10, 20, 30, 1), 30);
  assert.equal(triangular(20, 20, 20, 0.8), 20);
});

test('assistant rejects invalid itinerary and cost ranges', () => {
  const range = cost('person');
  for (const change of [
    { days: 0 },
    { days: 1.5 },
    { travelers: 21 },
    { rooms: 0 },
    { nights: 4 },
    { destination: '' },
  ])
    assert.throws(() => estimateTrip({ ...trip, ...change }, [range], emptyBudget));
  for (const change of [{ low: -1 }, { likely: 2000, high: 1000 }, { high: 1.2 }])
    assert.throws(() => estimateTrip(trip, [{ ...range, ...change }], emptyBudget));
  const fixed = estimateTrip(trip, [], emptyBudget);
  assert.equal(fixed.expected, 0);
  assert.equal(fixed.chanceWithinBudget, 100);
});

test('fixed saved estimates and a zero-night stay do not claim probabilistic uncertainty', () => {
  const saved = {
    ...emptyBudget,
    reserveInCents: 15000,
    expenses: [
      {
        id: 'transport',
        name: 'Travel',
        category: 'Transport' as const,
        amountInCents: 56000,
      },
      {
        id: 'stay',
        name: 'Stay',
        category: 'Accommodation' as const,
        amountInCents: 40000,
      },
      { id: 'food', name: 'Meals', category: 'Food' as const, amountInCents: 33333 },
      {
        id: 'fun',
        name: 'Activities',
        category: 'Activities' as const,
        amountInCents: 10000,
      },
      { id: 'other', name: 'Extras', category: 'Other' as const, amountInCents: 6333 },
    ],
  };
  const fixed = estimateTrip(trip, exampleRanges(saved), saved);
  assert.equal(fixed.hasUncertainty, false);
  assert.equal(fixed.expected, 160666);
  assert.equal(fixed.p10, fixed.p90);
  assert.ok(
    fixed.histogram.every(
      (bin) => bin.from === fixed.expected && bin.to === fixed.expected,
    ),
  );

  const stay = { ...cost('room-night'), high: 2000 };
  assert.equal(
    estimateTrip({ ...trip, nights: 0 }, [stay], emptyBudget).hasUncertainty,
    false,
  );
  assert.equal(estimateTrip(trip, [stay], emptyBudget).hasUncertainty, true);
});
