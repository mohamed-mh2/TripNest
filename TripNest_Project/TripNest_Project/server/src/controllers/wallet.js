import { failure } from '../models/budget.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createWalletController(model) {
  return {
    read: async (req, res, next) => {
      try {
        res.set('Cache-Control', 'no-store').json(await model.read(req.userId));
      } catch (e) {
        next(e);
      }
    },
    topup: async (req, res, next) => {
      try {
        const amount = req.body?.amountMinor;
        const key = req.get('Idempotency-Key');
        if (!Number.isSafeInteger(amount) || amount < 100 || amount > 500000)
          throw failure(
            400,
            'Choose a simulated amount from 1 to 5,000 EUR, in integer cents.',
          );
        if (!key || !uuid.test(key))
          throw failure(400, 'A valid Idempotency-Key is required.');
        // Ownership always comes from the verified session, never from the request body.
        res
          .set('Cache-Control', 'no-store')
          .json(await model.topup(req.userId, amount, key));
      } catch (e) {
        next(e);
      }
    },
  };
}
