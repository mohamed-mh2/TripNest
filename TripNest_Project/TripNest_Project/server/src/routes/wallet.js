import { Router } from 'express';
import { createWalletModel } from '../models/wallet.js';
import { createWalletController } from '../controllers/wallet.js';

export function walletRoutes(db) {
  const router = Router(),
    controller = createWalletController(createWalletModel(db));

  router.get('/wallet', controller.read);

  router.post('/wallet/topups', controller.topup);
  return router;
}
