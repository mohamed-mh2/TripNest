import { Router } from 'express';
import { requireSession } from '../middleware/auth.js';
import { createTripsController } from '../controllers/trips.js';

export function tripsRoutes(db, secret) {
  const router = Router();
  const controller = createTripsController(db);
  router.use(requireSession(db, secret));
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.validateId, controller.get);
  router.patch('/:id', controller.validateId, controller.update);
  router.delete('/:id', controller.validateId, controller.status);
  router.post('/:id/restore', controller.validateId, controller.status);
  return router;
}
