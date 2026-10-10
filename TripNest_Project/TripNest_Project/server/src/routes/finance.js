import { Router } from 'express';
import { budgetRoutes } from './budget.js';
import { walletRoutes } from './wallet.js';
import { cashRoutes } from './cash.js';
import { familyRoutes } from './family.js';

// #explain_notes: Mount this router under /api AFTER the team's JWT/session middleware.
// The middleware must set req.userId from the verified session, never from request data.

export function financeRoutes(db, secret) {
  const router = Router();
  router.use(
    budgetRoutes(db),
    walletRoutes(db),
    cashRoutes(db, secret),
    familyRoutes(db, secret),
  );
  return router;
}
