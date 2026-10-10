import { Router } from 'express';
import { createFamilyModel } from '../models/family.js';
import { createFamilyController } from '../controllers/family.js';

export function familyRoutes(db, secret) {
  const router = Router();
  const controller = createFamilyController(createFamilyModel(db, secret));

  router.get('/support-requests', controller.list);

  router.post('/support-requests', controller.create);

  router.post('/support-requests/resolve', controller.resolve);

  router.post('/support-requests/pay', controller.pay);

  router.post('/support-requests/:id/share', controller.share);

  router.post('/support-requests/:id/cancel', controller.cancel);
  return router;
}
