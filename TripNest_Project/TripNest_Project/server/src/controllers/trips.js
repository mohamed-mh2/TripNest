import { createTripsModel } from '../models/trips.js';
import { validateTrip } from '../tripValidation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createTripsController(db) {
  const model = createTripsModel(db);
  function validateId(req, res, next) {
    if (!UUID.test(req.params.id))
      return res.status(400).json({ error: 'Invalid trip ID.' });
    next();
  }
  async function list(req, res) {
    res.json({ trips: await model.listForUser(req.userId) });
  }
  async function get(req, res) {
    const trip = await model.findForUser(req.params.id, req.userId);
    return trip ? res.json({ trip }) : res.status(404).json({ error: 'Trip not found.' });
  }
  function validation(res, errors) {
    return res.status(400).json({
      error: {
        message: 'Check the highlighted fields.',
        code: 'VALIDATION',
        fields: errors,
      },
    });
  }
  async function create(req, res) {
    const { value, errors } = validateTrip(req.body);
    if (Object.keys(errors).length) return validation(res, errors);
    return res.status(201).json({ trip: await model.create(value, req.userId) });
  }
  async function update(req, res) {
    const { value, errors } = validateTrip(req.body, true);
    if (Object.keys(errors).length) return validation(res, errors);
    if (!Object.keys(value).length)
      return res.status(400).json({ error: 'Provide at least one field to update.' });
    const trip = await model.update(req.params.id, req.userId, value);
    return trip ? res.json({ trip }) : res.status(404).json({ error: 'Trip not found.' });
  }
  async function status(req, res) {
    const target = req.method === 'DELETE' ? 'archived' : 'active';
    const trip = await model.changeStatus(req.params.id, req.userId, target);
    return trip ? res.json({ trip }) : res.status(404).json({ error: 'Trip not found.' });
  }
  return { validateId, list, get, create, update, status };
}
