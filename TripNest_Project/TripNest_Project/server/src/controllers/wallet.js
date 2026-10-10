const wallet = require('../models/wallet');
function idOk(value) { return typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value); }
async function get(req, res, next) {
  try { return res.json(await wallet.walletForUser(req.user.id)); } catch (error) { return next(error); }
}
async function transact(req, res, next) {
  const { kind, amount, description, idempotencyKey } = req.body || {};
  if (!['credit', 'debit'].includes(kind) || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
      typeof description !== 'string' || description.trim().length < 2 || description.length > 180 ||
      typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    return res.status(400).json({ error: 'Provide a valid transaction kind, amount, description, and idempotency key.' });
  }
  try {
    const result = await wallet.transact({ userId: req.user.id, kind, amount: Math.round(amount * 100) / 100, description: description.trim(), idempotencyKey });
    if (result.error === 'insufficient') return res.status(409).json({ error: 'Wallet balance is insufficient.' });
    return res.status(result.duplicate ? 200 : 201).json({ ...result, demoNotice: 'Wallet transactions are simulated and do not move real money.' });
  } catch (error) { return next(error); }
}
async function requests(req, res, next) {
  try { return res.json({ requests: await wallet.listFamilyRequests(req.user.id, req.user.role === 'admin') }); } catch (error) { return next(error); }
}
async function requestSupport(req, res, next) {
  const { tripId, amount, message } = req.body || {};
  if ((tripId !== undefined && tripId !== null && !idOk(String(tripId))) ||
      typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
      typeof message !== 'string' || message.trim().length < 3 || message.length > 500) {
    return res.status(400).json({ error: 'Provide a valid trip, amount, and message.' });
  }
  try {
    const result = await wallet.createFamilyRequest({ userId: req.user.id, tripId: tripId ? String(tripId) : null, amount, message: message.trim() });
    return result ? res.status(201).json({ request: result }) : res.status(404).json({ error: 'Trip not found.' });
  } catch (error) { return next(error); }
}
async function decide(req, res, next) {
  if (!idOk(req.params.id) || !['approved', 'declined'].includes(req.body && req.body.status)) return res.status(400).json({ error: 'Invalid request id or decision.' });
  try {
    const result = await wallet.decideFamilyRequest(req.params.id, req.user.id, req.body.status);
    if (result.error === 'missing') return res.status(404).json({ error: 'Support request not found.' });
    if (result.error === 'decided') return res.status(409).json({ error: 'This support request has already been decided.' });
    return res.json(result);
  } catch (error) { return next(error); }
}
module.exports = { get, transact, requests, requestSupport, decide };
