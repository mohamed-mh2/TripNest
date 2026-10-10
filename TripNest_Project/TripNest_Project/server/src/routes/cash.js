import { Router } from 'express';
import { createCashModel } from '../models/cash.js';
import { createCashController } from '../controllers/cash.js';

export function cashRoutes(db, secret) {
  const router = Router();
  const controller = createCashController(createCashModel(db, secret));

  router.get('/cash/packages', controller.catalog);

  router.get('/cash/vouchers', controller.list);

  router.post('/cash/vouchers', controller.buy);

  router.post('/cash/redeem', controller.redeem);

  router.post('/cash/vouchers/:id/collect', controller.collect);
  return router;
}
