import { failure } from '../models/budget.js';
import { cashPackages } from '../models/cash.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const run = (work) => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store').json(await work(req));
  } catch (error) {
    next(error);
  }
};

export function createCashController(model) {
  return {
    catalog: run(() => ({
      packages: cashPackages,
      currency: 'EUR',
      destination: 'Barcelona',
      pickup: 'TripNest demonstration desk (not a real location)',
      simulation: true,
    })),
    list: run((req) => model.list(req.userId)),
    buy: run((req) => {
      const body = req.body ?? {},
        key = req.get('Idempotency-Key');
      if (!uuid.test(key ?? '') || !['demo_card', 'wallet'].includes(body.paymentMethod))
        throw failure(400, 'Choose a payment method and provide a request key.');
      if (body.paymentMethod === 'demo_card' && body.testOutcome === 'decline')
        throw failure(402, 'Demo card declined. No package was created.');
      if (body.paymentMethod === 'demo_card' && body.testOutcome !== 'approve')
        throw failure(400, 'Choose a valid demo card outcome.');
      return model.buy(req.userId, body.packageId, body.paymentMethod, key);
    }),
    redeem: run((req) => {
      const body = req.body ?? {};
      if (
        typeof body.code !== 'string' ||
        !/^TN-[0-9A-F]{24}$/i.test(body.code.trim()) ||
        !['wallet', 'cash'].includes(body.mode)
      )
        throw failure(400, 'Enter the complete TN- code and choose wallet or cash.');
      return model.redeem(req.userId, body.code, body.mode);
    }),
    collect: run((req) => {
      if (!uuid.test(req.params.id)) throw failure(400, 'Invalid pickup reference.');
      return model.collect(req.userId, req.params.id);
    }),
  };
}
