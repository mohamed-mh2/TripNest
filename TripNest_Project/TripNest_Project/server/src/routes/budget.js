import { Router } from 'express';
import { createBudgetController } from '../controllers/budget.js';
import { createBudgetModel } from '../models/budget.js';

export function budgetRoutes(db) {
  const router = Router();
  const c = createBudgetController(createBudgetModel(db));

  router.get('/trips/:tripId/budget', c.read);

  router.patch('/trips/:tripId/budget', c.plan);

  router.post('/trips/:tripId/expenses', c.save);

  router.post('/trips/:tripId/estimate-import', c.importEstimates);

  router.patch('/trips/:tripId/expenses/:expenseId', c.save);

  router.delete('/trips/:tripId/expenses/:expenseId', c.remove);
  return router;
}
