import { failure } from '../models/budget.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cents = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 100000000;
const categories = ['Transport', 'Accommodation', 'Food', 'Activities', 'Other'];

export function createBudgetController(model) {
  const wrap = (fn) => async (req, res, next) => {
    try {
      if (
        !uuid.test(req.params.tripId) ||
        (req.params.expenseId && !uuid.test(req.params.expenseId))
      )
        throw failure(400, 'Invalid identifier.');
      res.json(await fn(req));
    } catch (error) {
      next(error);
    }
  };
  return {
    read: wrap((req) => model.read(req.userId, req.params.tripId)),
    plan: wrap((req) => {
      const b = req.body ?? {};
      if (!cents(b.budgetMinor) || !cents(b.reserveMinor))
        throw failure(400, 'Budget and reserve must be valid integer cents.');
      return model.plan(req.userId, req.params.tripId, b);
    }),
    save: wrap((req) => {
      const b = req.body ?? {};
      if (
        typeof b.label !== 'string' ||
        !b.label.trim() ||
        b.label.trim().length > 80 ||
        !cents(b.amountMinor) ||
        b.amountMinor === 0 ||
        !categories.includes(b.category) ||
        (b.id !== undefined && !uuid.test(b.id)) ||
        (b.coveredByBookingId != null && !uuid.test(b.coveredByBookingId))
      )
        throw failure(400, 'Invalid expense.');
      return model.save(req.userId, req.params.tripId, req.params.expenseId, {
        ...b,
        label: b.label.trim(),
      });
    }),
    importEstimates: wrap((req) => {
      const b = req.body ?? {};
      if (
        !Number.isSafeInteger(b.expectedTotalMinor) ||
        b.expectedTotalMinor < 0 ||
        !Number.isInteger(b.expectedExpenseCount) ||
        b.expectedExpenseCount < 0 ||
        b.expectedExpenseCount > 1000 ||
        !Array.isArray(b.expenses) ||
        b.expenses.length < 1 ||
        b.expenses.length > 12
      )
        throw failure(400, 'Invalid estimate batch.');
      if (
        b.expenses.some(
          (e) =>
            !e ||
            !uuid.test(e.id ?? '') ||
            typeof e.label !== 'string' ||
            !e.label.trim() ||
            e.label.trim().length > 80 ||
            !cents(e.amountMinor) ||
            e.amountMinor === 0 ||
            !categories.includes(e.category),
        ) ||
        new Set(b.expenses.map((e) => e.id)).size !== b.expenses.length
      )
        throw failure(400, 'Invalid estimated expense.');
      return model.importEstimates(req.userId, req.params.tripId, {
        ...b,
        expenses: b.expenses.map((e) => ({ ...e, label: e.label.trim() })),
      });
    }),

    remove: wrap((req) =>
      model.remove(req.userId, req.params.tripId, req.params.expenseId),
    ),
  };
}
