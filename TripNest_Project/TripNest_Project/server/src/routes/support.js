import { Router } from 'express';
import { requireSession } from '../middleware/auth.js';
import { createSupportModel } from '../models/support.js';
import { createSupportController } from '../controllers/support.js';

export function supportRoutes(db, secret) {
  const router = Router();
  const controller = createSupportController(createSupportModel(db));
  const sendError = (res, status, code, message) =>
    res.status(status).json({ error: { code, message } });
  router.use(requireSession(db, secret));
  const requireTraveler = (req, res, next) => next();
  async function requireAdministrator(req, res, next) {
    try {
      // #explain_notes: The database grants support access; a browser role switch cannot grant it.
      const role = await db.query('SELECT user_id FROM support_agents WHERE user_id=$1', [
        req.userId,
      ]);
      if (!role.rows.length)
        return sendError(res, 403, 'FORBIDDEN', 'A support agent account is required.');
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireUuidParam(name) {
    return function validateUuidParam(req, res, next) {
      if (!controller.isUuid(req.params[name])) {
        return sendError(res, 400, 'INVALID_ID', `${name} must be a valid UUID.`);
      }
      return next();
    };
  }

  function rejectInvalidBody(parsed, res) {
    if (parsed.ok) {
      return false;
    }
    sendError(res, parsed.status, parsed.code, parsed.message);
    return true;
  }

  function asyncRoute(handler) {
    return function runSupportRoute(req, res, next) {
      Promise.resolve(handler(req, res, next)).catch((error) => {
        if (res.headersSent) {
          return next(error);
        }
        const published = controller.toPublicError(error);
        return res.status(published.status).json(published.body);
      });
    };
  }

  router.get(
    '/readiness/:tripId',
    requireUuidParam('tripId'),
    requireTraveler,
    asyncRoute(controller.getReadiness),
  );

  router.patch(
    '/readiness/:tripId',
    requireUuidParam('tripId'),
    requireTraveler,
    (req, res, next) => {
      const parsed = controller.parseReadinessPatch(req.body);
      if (rejectInvalidBody(parsed, res)) {
        return undefined;
      }
      req.support = parsed.value;
      return next();
    },
    asyncRoute(controller.updateReadiness),
  );

  router.get('/tickets', requireTraveler, asyncRoute(controller.listTickets));

  router.post(
    '/tickets',
    requireTraveler,
    (req, res, next) => {
      const parsed = controller.parseCreateTicket(req.body);
      if (rejectInvalidBody(parsed, res)) {
        return undefined;
      }
      req.support = parsed.value;
      return next();
    },
    asyncRoute(controller.createTicket),
  );

  router.get(
    '/tickets/:ticketId/alternative',
    requireUuidParam('ticketId'),
    requireTraveler,
    asyncRoute(controller.getTravelerAlternative),
  );

  router.patch(
    '/tickets/:ticketId/alternative',
    requireUuidParam('ticketId'),
    requireTraveler,
    (req, res, next) => {
      const parsed = controller.parseAlternativeDecision(req.body);
      if (rejectInvalidBody(parsed, res)) {
        return undefined;
      }
      req.support = parsed.value;
      return next();
    },
    asyncRoute(controller.decideTravelerAlternative),
  );

  router.get(
    '/tickets/:ticketId',
    requireUuidParam('ticketId'),
    requireTraveler,
    asyncRoute(controller.getTicket),
  );

  router.get(
    '/admin/tickets',
    requireAdministrator,
    (req, res, next) => {
      const parsed = controller.parseAdminStatusFilter(req.query.status);
      if (rejectInvalidBody(parsed, res)) {
        return undefined;
      }
      req.support = { status: parsed.value };
      return next();
    },
    asyncRoute(controller.listAdminTickets),
  );

  router.get(
    '/admin/tickets/:ticketId/alternative',
    requireUuidParam('ticketId'),
    requireAdministrator,
    asyncRoute(controller.getAdminAlternative),
  );

  router.post(
    '/admin/tickets/:ticketId/alternative',
    requireUuidParam('ticketId'),
    requireAdministrator,
    (req, res, next) => {
      const parsed = controller.parseAlternativeProposal(req.body);
      if (rejectInvalidBody(parsed, res)) {
        return undefined;
      }
      req.support = parsed.value;
      return next();
    },
    asyncRoute(controller.createAdminAlternative),
  );

  router.get(
    '/admin/tickets/:ticketId',
    requireUuidParam('ticketId'),
    requireAdministrator,
    asyncRoute(controller.getAdminTicket),
  );

  router.patch(
    '/admin/tickets/:ticketId',
    requireUuidParam('ticketId'),
    requireAdministrator,
    (req, res, next) => {
      const parsed = controller.parseAdminTicketPatch(req.body);
      if (rejectInvalidBody(parsed, res)) {
        return undefined;
      }
      req.support = parsed.value;
      return next();
    },
    asyncRoute(controller.updateAdminTicket),
  );

  router.get(
    '/trips/:tripId/export',
    requireUuidParam('tripId'),
    requireTraveler,
    asyncRoute(controller.exportTripSummary),
  );

  return router;
}
