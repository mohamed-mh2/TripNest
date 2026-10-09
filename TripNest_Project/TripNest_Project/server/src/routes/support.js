// مسارات Express وطرق REST والتحقق من المدخلات واستدعاء وسيط المصادقة ثم controller الخاص بـ قائمة الاستعداد وتصدير ملخص الرحلة وطلبات المساعدة ومعالجتها من المسؤول؛ خصائص eSIM والفعاليات تستخدم محرك الحجز المشترك. المسؤول: mohamed fody.
"use strict";

const express = require("express");
const auth = require("../middleware/auth");
const controller = require("../controllers/support");

const router = express.Router();

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

function namedGuard(source, names) {
  for (const name of names) {
    if (source && typeof source[name] === "function") {
      return source[name];
    }
  }
  return null;
}

function readUserId(req) {
  const user = req.user || req.auth;
  if (!user || typeof user !== "object") {
    return null;
  }
  const id = user.id || user.userId || user.sub;
  return controller.isUuid(id) ? id : null;
}

function requireTraveler(req, res, next) {
  const guard = namedGuard(auth, ["requireUser", "requireAuth", "authenticate", "verifyToken", "default"]);
  if (!guard && typeof auth === "function") {
    return auth(req, res, (error) => finishTraveler(error, req, res, next));
  }
  if (!guard) {
    return sendError(
      res,
      403,
      "AUTH_NOT_CONNECTED",
      "Authentication middleware is not connected. Sign-in cannot be verified.",
    );
  }
  return guard(req, res, (error) => finishTraveler(error, req, res, next));
}

function finishTraveler(error, req, res, next) {
  if (res.headersSent) {
    return undefined;
  }
  if (error) {
    return next(error);
  }
  if (!readUserId(req)) {
    return sendError(
      res,
      403,
      "AUTH_NOT_CONNECTED",
      "Authentication middleware did not provide a user id.",
    );
  }
  return next();
}

function requireAdministrator(req, res, next) {
  const adminGuard = namedGuard(auth, ["requireAdmin"]);
  if (adminGuard) {
    return adminGuard(req, res, (error) => {
      if (res.headersSent) {
        return undefined;
      }
      if (error) {
        return next(error);
      }
      if (!readUserId(req)) {
        return sendError(
          res,
          403,
          "AUTH_NOT_CONNECTED",
          "Authentication middleware did not provide an admin user id.",
        );
      }
      return next();
    });
  }
  const userGuard =
    namedGuard(auth, ["requireUser", "requireAuth", "authenticate", "verifyToken", "default"]) ||
    (typeof auth === "function" ? auth : null);
  if (!userGuard) {
    return sendError(
      res,
      403,
      "AUTH_NOT_CONNECTED",
      "Authentication middleware is not connected. Admin access cannot be verified.",
    );
  }
  return userGuard(req, res, (error) => {
    if (res.headersSent) {
      return undefined;
    }
    if (error) {
      return next(error);
    }
    const user = req.user || req.auth;
    const role = user && (user.role || user.accountRole);
    const isAdmin = role === "admin" || (user && user.isAdmin === true);
    if (!isAdmin || !readUserId(req)) {
      return sendError(res, 403, "FORBIDDEN", "An administrator account is required.");
    }
    return next();
  });
}

function requireUuidParam(name) {
  return function validateUuidParam(req, res, next) {
    if (!controller.isUuid(req.params[name])) {
      return sendError(res, 400, "INVALID_ID", `${name} must be a valid UUID.`);
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
  "/readiness/:tripId",
  requireUuidParam("tripId"),
  requireTraveler,
  asyncRoute(controller.getReadiness),
);

router.patch(
  "/readiness/:tripId",
  requireUuidParam("tripId"),
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

router.get("/tickets", requireTraveler, asyncRoute(controller.listTickets));

router.post("/tickets", requireTraveler, (req, res, next) => {
  const parsed = controller.parseCreateTicket(req.body);
  if (rejectInvalidBody(parsed, res)) {
    return undefined;
  }
  req.support = parsed.value;
  return next();
}, asyncRoute(controller.createTicket));

router.get(
  "/tickets/:ticketId/alternative",
  requireUuidParam("ticketId"),
  requireTraveler,
  asyncRoute(controller.getTravelerAlternative),
);

router.patch(
  "/tickets/:ticketId/alternative",
  requireUuidParam("ticketId"),
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
  "/tickets/:ticketId",
  requireUuidParam("ticketId"),
  requireTraveler,
  asyncRoute(controller.getTicket),
);

router.get("/admin/tickets", requireAdministrator, (req, res, next) => {
  const parsed = controller.parseAdminStatusFilter(req.query.status);
  if (rejectInvalidBody(parsed, res)) {
    return undefined;
  }
  req.support = { status: parsed.value };
  return next();
}, asyncRoute(controller.listAdminTickets));

router.get(
  "/admin/tickets/:ticketId/alternative",
  requireUuidParam("ticketId"),
  requireAdministrator,
  asyncRoute(controller.getAdminAlternative),
);

router.post(
  "/admin/tickets/:ticketId/alternative",
  requireUuidParam("ticketId"),
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
  "/admin/tickets/:ticketId",
  requireUuidParam("ticketId"),
  requireAdministrator,
  asyncRoute(controller.getAdminTicket),
);

router.patch(
  "/admin/tickets/:ticketId",
  requireUuidParam("ticketId"),
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
  "/trips/:tripId/export",
  requireUuidParam("tripId"),
  requireTraveler,
  asyncRoute(controller.exportTripSummary),
);

module.exports = router;
