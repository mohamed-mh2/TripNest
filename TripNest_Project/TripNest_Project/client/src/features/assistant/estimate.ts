import {
  calculateBudget,
  maximumAmount,
  type BudgetState,
  type Category,
} from '../budget/model.ts';

export type CostRange = {
  id: string;
  label: string;
  category: Category;
  unit: 'person' | 'person-day' | 'room-night';
  low: number;
  likely: number;
  high: number;
  include: boolean;
};

export type Itinerary = {
  destination: string;
  days: number;
  nights: number;
  travelers: number;
  rooms: number;
};

export type EstimateResult = {
  expected: number;
  p10: number;
  p50: number;
  p90: number;
  chanceWithinBudget: number;
  fixed: number;
  rows: { category: Category; name: string; amountInCents: number }[];
  histogram: { from: number; to: number; count: number }[];
  simulations: number;
  hasUncertainty: boolean;
};

export function exampleRanges(budget: BudgetState): CostRange[] {
  const occupied = new Set(budget.expenses.map((e) => e.category));
  const booked = (budget.bookedNetInCents ?? 0) > 0;
  return [
    {
      id: 'travel',
      label: 'Return travel',
      category: 'Transport',
      unit: 'person',
      low: 10000,
      likely: 18000,
      high: 35000,
    },
    {
      id: 'stay',
      label: 'Accommodation',
      category: 'Accommodation',
      unit: 'room-night',
      low: 5000,
      likely: 9000,
      high: 16000,
    },
    {
      id: 'food',
      label: 'Food & drinks',
      category: 'Food',
      unit: 'person-day',
      low: 1500,
      likely: 3000,
      high: 5500,
    },
    {
      id: 'local',
      label: 'Local transport',
      category: 'Transport',
      unit: 'person-day',
      low: 500,
      likely: 1200,
      high: 2500,
    },
    {
      id: 'fun',
      label: 'Activities',
      category: 'Activities',
      unit: 'person',
      low: 1000,
      likely: 4000,
      high: 10000,
    },
    {
      id: 'extras',
      label: 'Other expenses',
      category: 'Other',
      unit: 'person',
      low: 1000,
      likely: 2500,
      high: 6000,
    },
  ].map((r) => ({
    ...r,
    include:
      !occupied.has(r.category as Category) &&
      !(booked && ['travel', 'stay'].includes(r.id)),
  })) as CostRange[];
}

// #explain_notes: A triangular distribution uses the user's lowest, most likely and highest costs.

export function triangular(low: number, likely: number, high: number, u: number): number {
  if (low === high) return low;
  const split = (likely - low) / (high - low);
  return u < split
    ? low + Math.sqrt(u * (high - low) * (likely - low))
    : high - Math.sqrt((1 - u) * (high - low) * (high - likely));
}

export function estimateTrip(
  itinerary: Itinerary,
  ranges: CostRange[],
  budget: BudgetState,
): EstimateResult {
  if (!itinerary.destination.trim() || itinerary.destination.trim().length > 80)
    throw new Error('Enter a destination (up to 80 characters).');
  for (const [name, value, min, max] of [
    ['Days', itinerary.days, 1, 60],
    ['Nights', itinerary.nights, 0, 60],
    ['Travelers', itinerary.travelers, 1, 20],
    ['Rooms', itinerary.rooms, 1, 20],
  ] as const) {
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  }
  if (itinerary.nights > itinerary.days)
    throw new Error('Nights cannot exceed trip days.');
  const selected = ranges.filter((r) => r.include);
  for (const r of selected) {
    if (
      ![r.low, r.likely, r.high].every(
        (n) => Number.isSafeInteger(n) && n >= 0 && n <= maximumAmount,
      ) ||
      r.low > r.likely ||
      r.likely > r.high
    )
      throw new Error(
        `${r.label}: use 0 ≤ low ≤ most likely ≤ high, up to 1,000,000 EUR.`,
      );
  }
  const units = (r: CostRange) =>
    r.unit === 'room-night'
      ? itinerary.rooms * itinerary.nights
      : r.unit === 'person-day'
        ? itinerary.travelers * itinerary.days
        : itinerary.travelers;
  const fixed = calculateBudget(budget).estimatedInCents;
  const grouped = new Map<Category, number>();
  for (const r of selected) {
    const cost = Math.round(((r.low + r.likely + r.high) / 3) * units(r));
    grouped.set(r.category, (grouped.get(r.category) ?? 0) + cost);
  }
  const rows = [...grouped]
    .filter(([, amount]) => amount > 0)
    .map(([category, amountInCents]) => ({
      category,
      name: `${itinerary.destination.trim().slice(0, 45)} · ${category}`,
      amountInCents,
    }));
  if (rows.some((r) => r.amountInCents > maximumAmount))
    throw new Error(
      'A category exceeds the supported amount. Reduce the rates or trip size.',
    );
  const expected = fixed + rows.reduce((n, r) => n + r.amountInCents, 0);

  // #explain_notes: A fixed seed makes comparisons repeatable. Costs are modeled independently, not inferred from market data.
  let seed = 20261009;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed + 0.5) / 4294967296;
  };
  const simulations = 4000;
  const samples = Array.from({ length: simulations }, () =>
    Math.round(
      fixed +
        selected.reduce(
          (total, r) => total + triangular(r.low, r.likely, r.high, random()) * units(r),
          0,
        ),
    ),
  ).sort((a, b) => a - b);
  const quantile = (p: number) => samples[Math.floor((simulations - 1) * p)];
  const min = samples[0],
    max = samples[simulations - 1],
    width = Math.max(1, (max - min) / 12);
  const histogram = Array.from({ length: 12 }, (_, i) => ({
    from: Math.min(max, Math.round(min + i * width)),
    to: Math.min(max, Math.round(min + (i + 1) * width)),
    count: 0,
  }));
  for (const sample of samples)
    histogram[Math.min(11, Math.floor((sample - min) / width))].count++;
  return {
    expected,
    p10: quantile(0.1),
    p50: quantile(0.5),
    p90: quantile(0.9),
    fixed,
    rows,
    histogram,
    simulations,
    hasUncertainty: selected.some((r) => r.low < r.high && units(r) > 0),
    chanceWithinBudget: Math.round(
      (samples.filter((n) => n <= budget.budgetInCents).length / simulations) * 100,
    ),
  };
}
