import { failure } from '../models/budget.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const run = (work) => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store').json(await work(req));
  } catch (error) {
    next(error);
  }
};

function requestKey(req) {
  const key = req.get('Idempotency-Key');
  if (!uuid.test(key ?? '')) throw failure(400, 'Provide a valid request key.');
  return key;
}

function token(req) {
  const value = req.body?.token;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw failure(400, 'Enter a valid support link or token.');
  return value;
}

function id(req) {
  if (!uuid.test(req.params.id)) throw failure(400, 'Invalid support request ID.');
  return req.params.id;
}

export function createFamilyController(model) {
  return {
    list: run((req) => model.list(req.userId)),
    create: run((req) => {
      const amount = req.body?.amountMinor;
      if (!Number.isSafeInteger(amount) || amount < 500 || amount > 500000)
        throw failure(400, 'Choose 5 to 5,000 EUR with up to two decimal places.');
      return model.create(req.userId, amount, requestKey(req));
    }),
    share: run((req) => model.share(req.userId, id(req))),
    cancel: run((req) => model.cancel(req.userId, id(req))),
    resolve: run((req) => model.resolve(req.userId, token(req))),
    pay: run((req) => {
      const outcome = req.body?.testOutcome;
      if (!['approve', 'decline'].includes(outcome))
        throw failure(400, 'Choose a demo payment outcome.');
      return model.pay(req.userId, token(req), requestKey(req), outcome);
    }),
  };
}
