import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount,
  calculateBudget,
  decodeBudget,
} from '../src/features/budget/model.ts';

test('money parsing rejects invalid precision, negatives and out-of-range values', () => {
  assert.equal(parseAmount('20.50'), 2050);
  assert.equal(parseAmount('0.29'), 29);
  assert.equal(parseAmount('0'), 0);
  for (const value of ['', '-2', '2.005', 'Infinity', '1e3', '1000001'])
    assert.equal(parseAmount(value), null);
});
test('budget combines expenses and reserve exactly, independently of wallet balance', () => {
  const state = {
    budgetInCents: 160000,
    reserveInCents: 15000,
    expenses: [
      {
        id: '1',
        name: 'Hotel',
        category: 'Accommodation' as const,
        amountInCents: 54000,
      },
      { id: '2', name: 'Food', category: 'Food' as const, amountInCents: 18000 },
      {
        id: '3',
        name: 'Transport',
        category: 'Transport' as const,
        amountInCents: 25000,
      },
    ],
  };
  assert.deepEqual(calculateBudget(state), {
    expensesInCents: 97000,
    estimatedInCents: 112000,
    remainingInCents: 48000,
  });
  assert.equal(calculateBudget({ ...state, budgetInCents: 0 }).remainingInCents, -112000);
});
test('saved data validation rejects corruption, unknown versions and duplicated IDs', () => {
  const record = {
    version: 1,
    budgetInCents: 160000,
    reserveInCents: 0,
    expenses: [{ id: 'a', name: 'Taxi', category: 'Transport', amountInCents: 2500 }],
  };
  assert.ok(decodeBudget(JSON.stringify(record)));
  assert.equal(decodeBudget('{bad json'), null);
  assert.equal(decodeBudget(JSON.stringify({ ...record, version: 2 })), null);
  assert.equal(
    decodeBudget(
      JSON.stringify({ ...record, expenses: [...record.expenses, ...record.expenses] }),
    ),
    null,
  );
  assert.equal(decodeBudget(JSON.stringify({ ...record, reserveInCents: -1 })), null);
});
