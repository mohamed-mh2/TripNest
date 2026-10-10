// معالجة الطلبات وقواعد العمل والاستجابات والأخطاء الخاصة بـ قائمة الاستعداد وتصدير ملخص الرحلة وطلبات المساعدة ومعالجتها من المسؤول؛ خصائص eSIM والفعاليات تستخدم محرك الحجز المشترك؛ استخدام models للوصول إلى البيانات. المسؤول: mohamed fody.

export function createSupportController(model) {
  const STATUS_LABELS = Object.freeze({
    open: 'Open',
    in_progress: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed',
  });

  const TRANSITIONS = Object.freeze({
    open: Object.freeze(['in_progress', 'closed']),
    in_progress: Object.freeze(['resolved', 'closed']),
    resolved: Object.freeze(['closed']),
    closed: Object.freeze([]),
  });

  class SupportHttpError extends Error {
    constructor(status, code, message) {
      super(message);
      this.name = 'SupportHttpError';
      this.status = status;
      this.code = code;
    }
  }

  function allowedNextStatuses(status) {
    switch (status) {
      case 'open':
        return TRANSITIONS.open;
      case 'in_progress':
        return TRANSITIONS.in_progress;
      case 'resolved':
        return TRANSITIONS.resolved;
      case 'closed':
        return TRANSITIONS.closed;
      default:
        return [];
    }
  }

  function isUuid(value) {
    return typeof value === 'string' && model.UUID_PATTERN.test(value);
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function unexpectedKeys(body, allowed) {
    return Object.keys(body).filter((key) => !allowed.includes(key));
  }

  function validation(message) {
    return { ok: false, status: 400, code: 'VALIDATION', message };
  }

  function parseReadinessPatch(body) {
    if (!isRecord(body)) {
      return validation('Request body must be an object.');
    }
    const extra = unexpectedKeys(body, ['itemKey', 'completed']);
    if (extra.length > 0) {
      return validation('Request body contains unsupported fields.');
    }
    if (!model.READINESS_ITEM_KEYS.includes(body.itemKey)) {
      return validation('itemKey is not a readiness item.');
    }
    if (typeof body.completed !== 'boolean') {
      return validation('completed must be true or false.');
    }
    return { ok: true, value: { itemKey: body.itemKey, completed: body.completed } };
  }

  function parseCreateTicket(body) {
    if (!isRecord(body)) {
      return validation('Request body must be an object.');
    }
    const extra = unexpectedKeys(body, ['tripId', 'category', 'message']);
    if (extra.length > 0) {
      return validation('Request body contains unsupported fields.');
    }
    if (!isUuid(body.tripId)) {
      return validation('tripId must be a valid UUID.');
    }
    if (!model.TICKET_CATEGORIES.includes(body.category)) {
      return validation('category is not supported.');
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 10 || message.length > 2000) {
      return validation('message must be between 10 and 2000 characters.');
    }
    return {
      ok: true,
      value: { tripId: body.tripId, category: body.category, message },
    };
  }

  function parseAdminTicketPatch(body) {
    if (!isRecord(body)) {
      return validation('Request body must be an object.');
    }
    const extra = unexpectedKeys(body, ['status', 'resolutionNote']);
    if (extra.length > 0) {
      return validation('Request body contains unsupported fields.');
    }
    if (body.status !== undefined && !model.TICKET_STATUSES.includes(body.status)) {
      return validation('status is not supported.');
    }
    if (
      body.resolutionNote !== undefined &&
      body.resolutionNote !== null &&
      (typeof body.resolutionNote !== 'string' ||
        body.resolutionNote.trim().length < 10 ||
        body.resolutionNote.trim().length > 2000)
    ) {
      return validation('resolutionNote must be between 10 and 2000 characters.');
    }
    if (body.status === undefined && body.resolutionNote === undefined) {
      return validation('A status or resolution note is required.');
    }
    return {
      ok: true,
      value: {
        status: body.status,
        resolutionNote:
          typeof body.resolutionNote === 'string'
            ? body.resolutionNote.trim()
            : body.resolutionNote,
      },
    };
  }

  function parseOptionalTimestamp(value, label) {
    if (value === undefined || value === null || value === '') {
      return { ok: true, value: null };
    }
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      return validation(`${label} must be an ISO timestamp.`);
    }
    return { ok: true, value: new Date(value).toISOString() };
  }

  function parseOptionalMinor(value, label) {
    if (value === undefined || value === null || value === '') {
      return { ok: true, value: null };
    }
    if (!Number.isInteger(value) || value < 0 || value > 100000000) {
      return validation(`${label} must be a non-negative minor-unit integer.`);
    }
    return { ok: true, value };
  }

  function parseAlternativeProposal(body) {
    if (!isRecord(body)) {
      return validation('Request body must be an object.');
    }
    const allowed = [
      'originalTitle',
      'originalStartAt',
      'originalEndAt',
      'originalPriceMinor',
      'alternativeTitle',
      'alternativeStartAt',
      'alternativeEndAt',
      'alternativePriceMinor',
      'currency',
    ];
    if (unexpectedKeys(body, allowed).length > 0) {
      return validation('Request body contains unsupported fields.');
    }
    const originalTitle =
      typeof body.originalTitle === 'string' ? body.originalTitle.trim() : '';
    const alternativeTitle =
      typeof body.alternativeTitle === 'string' ? body.alternativeTitle.trim() : '';
    if (originalTitle.length < 1 || originalTitle.length > 200) {
      return validation('originalTitle must be between 1 and 200 characters.');
    }
    if (alternativeTitle.length < 1 || alternativeTitle.length > 200) {
      return validation('alternativeTitle must be between 1 and 200 characters.');
    }
    const currency =
      body.currency === undefined ? 'EUR' : String(body.currency).trim().toUpperCase();
    if (currency !== 'EUR') {
      return validation('currency must be EUR.');
    }
    const originalStartAt = parseOptionalTimestamp(
      body.originalStartAt,
      'originalStartAt',
    );
    const originalEndAt = parseOptionalTimestamp(body.originalEndAt, 'originalEndAt');
    const alternativeStartAt = parseOptionalTimestamp(
      body.alternativeStartAt,
      'alternativeStartAt',
    );
    const alternativeEndAt = parseOptionalTimestamp(
      body.alternativeEndAt,
      'alternativeEndAt',
    );
    const originalPriceMinor = parseOptionalMinor(
      body.originalPriceMinor,
      'originalPriceMinor',
    );
    const alternativePriceMinor = parseOptionalMinor(
      body.alternativePriceMinor,
      'alternativePriceMinor',
    );
    const parts = [
      originalStartAt,
      originalEndAt,
      alternativeStartAt,
      alternativeEndAt,
      originalPriceMinor,
      alternativePriceMinor,
    ];
    const failed = parts.find((part) => !part.ok);
    if (failed) {
      return failed;
    }
    return {
      ok: true,
      value: {
        originalTitle,
        originalStartAt: originalStartAt.value,
        originalEndAt: originalEndAt.value,
        originalPriceMinor: originalPriceMinor.value,
        alternativeTitle,
        alternativeStartAt: alternativeStartAt.value,
        alternativeEndAt: alternativeEndAt.value,
        alternativePriceMinor: alternativePriceMinor.value,
        currency,
      },
    };
  }

  function parseAlternativeDecision(body) {
    if (!isRecord(body)) {
      return validation('Request body must be an object.');
    }
    if (unexpectedKeys(body, ['decision', 'travelerNote']).length > 0) {
      return validation('Request body contains unsupported fields.');
    }
    if (body.decision !== 'accepted' && body.decision !== 'rejected') {
      return validation('decision must be accepted or rejected.');
    }
    if (
      body.travelerNote !== undefined &&
      (typeof body.travelerNote !== 'string' || body.travelerNote.trim().length > 2000)
    ) {
      return validation('travelerNote must be 2000 characters or fewer.');
    }
    return {
      ok: true,
      value: {
        decision: body.decision,
        travelerNote:
          typeof body.travelerNote === 'string' ? body.travelerNote.trim() : undefined,
      },
    };
  }

  function parseAdminStatusFilter(status) {
    if (status === undefined) {
      return { ok: true, value: undefined };
    }
    if (typeof status !== 'string' || !model.TICKET_STATUSES.includes(status)) {
      return validation('status filter is not supported.');
    }
    return { ok: true, value: status };
  }

  function planAdminTicketChange(current, input) {
    const nextStatus = input.status || current.status;
    const statusChanged = nextStatus !== current.status;
    if (!model.TICKET_STATUSES.includes(nextStatus)) {
      throw new SupportHttpError(400, 'VALIDATION', 'status is not supported.');
    }
    if (
      current.status === 'closed' &&
      (statusChanged || input.resolutionNote !== undefined)
    ) {
      throw new SupportHttpError(
        409,
        'INVALID_TRANSITION',
        'Closed tickets cannot be changed.',
      );
    }
    const allowed = allowedNextStatuses(current.status);
    if (statusChanged && !allowed.includes(nextStatus)) {
      throw new SupportHttpError(
        409,
        'INVALID_TRANSITION',
        `Cannot move a ticket from ${current.status} to ${nextStatus}.`,
      );
    }
    const nextNote =
      input.resolutionNote === undefined ? current.resolutionNote : input.resolutionNote;
    if (nextStatus === 'resolved' && (!nextNote || nextNote.length < 10)) {
      throw new SupportHttpError(
        400,
        'INVALID_NOTE',
        'A resolution note of at least 10 characters is required to resolve a ticket.',
      );
    }
    const noteChanged = nextNote !== current.resolutionNote;
    if (!statusChanged && !noteChanged) {
      return {
        unchanged: true,
        status: current.status,
        resolutionNote: current.resolutionNote,
        audits: [],
      };
    }
    const audits = [];
    const metadata = { previousStatus: current.status, newStatus: nextStatus };
    if (statusChanged) {
      audits.push({ action: 'support_ticket_status_changed', metadata });
    }
    if (noteChanged) {
      audits.push({ action: 'support_ticket_resolution_updated', metadata });
    }
    return {
      unchanged: false,
      status: nextStatus,
      resolutionNote: nextNote,
      audits,
    };
  }

  function assertCanPropose(ticket, existing) {
    if (!ticket) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Support ticket not found.');
    }
    if (ticket.status === 'closed') {
      throw new SupportHttpError(
        409,
        'CONFLICT',
        'Alternatives cannot be proposed for a closed ticket.',
      );
    }
    if (ticket.status !== 'in_progress') {
      throw new SupportHttpError(
        409,
        'CONFLICT',
        'Move the ticket to in progress before proposing an alternative.',
      );
    }
    if (existing && existing.status === 'pending') {
      throw new SupportHttpError(
        409,
        'CONFLICT',
        'This ticket already has a pending alternative.',
      );
    }
  }

  function planAlternativeDecision(alternative, decision) {
    if (!alternative) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'No alternative has been proposed.');
    }
    if (alternative.status !== 'pending') {
      throw new SupportHttpError(
        409,
        'CONFLICT',
        'This alternative has already been decided.',
      );
    }
    if (decision !== 'accepted' && decision !== 'rejected') {
      throw new SupportHttpError(
        400,
        'VALIDATION',
        'decision must be accepted or rejected.',
      );
    }
    return {
      decision,
      replacementExecutionRequired: decision === 'accepted',
      bookingMutated: false,
      ticketStatusChange: null,
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function safeCount(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
      return 0;
    }
    return number;
  }

  function renderTripSummaryHtml(summary) {
    const references = summary.bookingReferences
      .map((reference) => `<li>${escapeHtml(reference)}</li>`)
      .join('');
    const supportRows = summary.support.byStatus
      .map((item) => `<li>${escapeHtml(item.label)}: ${safeCount(item.count)}</li>`)
      .join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TripNest trip summary</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1c2430; background: #f3f6f4; }
    main { width: min(100% - 32px, 720px); margin: 32px auto; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 2rem; letter-spacing: -0.02em; }
    h2 { font-size: 1.05rem; margin-bottom: 8px; }
    .brand { color: #0f6e6e; font-weight: 700; margin-bottom: 8px; }
    .section { background: #fff; border: 1px solid #e2e8e4; border-radius: 16px; padding: 20px; margin-top: 16px; }
    ul { margin: 8px 0 0; padding-inline-start: 1.2rem; }
    .note { color: #5c6b73; line-height: 1.5; }
    @media print { body { background: #fff; } main { width: auto; margin: 0; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <p class="brand">TripNest</p>
    <h1>Trip Summary</h1>
    <section class="section">
      <h2>Trip overview</h2>
      <p>${escapeHtml(summary.tripName)}</p>
      <p>${escapeHtml(summary.origin)} to ${escapeHtml(summary.destination)}</p>
      <p>${escapeHtml(summary.startDate)} to ${escapeHtml(summary.endDate)}</p>
      <p>${safeCount(summary.travelerCount)} travelers · ${escapeHtml(summary.currency)}</p>
      <p>Booking references</p>
      <ul>${references}</ul>
    </section>
    <section class="section">
      <h2>Readiness</h2>
      <p>${safeCount(summary.readiness.completed)} of ${safeCount(summary.readiness.total)} complete (${safeCount(summary.readiness.percentage)}%)</p>
    </section>
    <section class="section">
      <h2>Support</h2>
      <p>${safeCount(summary.support.total)} requests</p>
      <ul>${supportRows}</ul>
    </section>
    <section class="section">
      <p class="note">Overview of your saved trip and confirmed bookings. This is a TripNest academic demo summary. Travel services and transactions are simulated.</p>
    </section>
  </main>
</body>
</html>`;
  }

  function redactMessage(message) {
    if (typeof message !== 'string' || message.length === 0) {
      return 'Something went wrong. Please try again.';
    }
    if (
      /select |insert |update |delete |syntax error|password|token|secret|credential/i.test(
        message,
      )
    ) {
      return 'Something went wrong. Please try again.';
    }
    return message;
  }

  function toPublicError(error) {
    if (error instanceof SupportHttpError) {
      return {
        status: error.status,
        body: { error: { code: error.code, message: redactMessage(error.message) } },
      };
    }
    if (
      error instanceof model.SupportDataError ||
      (error && error.name === 'SupportDataError')
    ) {
      switch (error.code) {
        case 'VALIDATION':
          return {
            status: 400,
            body: {
              error: { code: 'VALIDATION', message: redactMessage(error.message) },
            },
          };
        case 'FORBIDDEN':
          return {
            status: 403,
            body: { error: { code: 'FORBIDDEN', message: redactMessage(error.message) } },
          };
        case 'NOT_FOUND':
          return {
            status: 404,
            body: { error: { code: 'NOT_FOUND', message: redactMessage(error.message) } },
          };
        case 'CONFLICT':
          return {
            status: 409,
            body: { error: { code: 'CONFLICT', message: redactMessage(error.message) } },
          };
        case 'DB_UNAVAILABLE':
          return {
            status: 500,
            body: {
              error: {
                code: 'DB_UNAVAILABLE',
                message: 'PostgreSQL connection is not configured.',
              },
            },
          };
        default:
          return {
            status: 500,
            body: {
              error: {
                code: 'SUPPORT_DATA_UNAVAILABLE',
                message: 'Support data is unavailable.',
              },
            },
          };
      }
    }
    return {
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      },
    };
  }

  function sendData(res, status, data) {
    res.status(status).json({ data });
  }

  function actorId(req) {
    const user = req.user || req.auth;
    const id = req.userId || (user && (user.id || user.userId || user.sub));
    if (!isUuid(id)) {
      throw new SupportHttpError(
        403,
        'AUTH_NOT_CONNECTED',
        'Authentication middleware did not provide a user id.',
      );
    }
    return id;
  }

  function toTravelerTicket(ticket) {
    return {
      id: ticket.id,
      tripId: ticket.tripId,
      category: ticket.category,
      message: ticket.message,
      status: ticket.status,
      resolutionNote: ticket.resolutionNote,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  function toAdminTicket(ticket) {
    return {
      id: ticket.id,
      tripId: ticket.tripId,
      ownerId: ticket.ownerId,
      bookingId: ticket.bookingId,
      category: ticket.category,
      message: ticket.message,
      status: ticket.status,
      resolutionNote: ticket.resolutionNote,
      assignedAdminId: ticket.assignedAdminId,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  function toPublicAlternative(alternative) {
    if (!alternative) {
      return null;
    }
    return {
      id: alternative.id,
      ticketId: alternative.ticketId,
      status: alternative.status,
      originalTitle: alternative.originalTitle,
      originalStartAt: alternative.originalStartAt,
      originalEndAt: alternative.originalEndAt,
      originalPriceMinor: alternative.originalPriceMinor,
      alternativeTitle: alternative.alternativeTitle,
      alternativeStartAt: alternative.alternativeStartAt,
      alternativeEndAt: alternative.alternativeEndAt,
      alternativePriceMinor: alternative.alternativePriceMinor,
      currency: alternative.currency,
      travelerNote: alternative.travelerNote,
      proposedAt: alternative.proposedAt,
      decidedAt: alternative.decidedAt,
    };
  }

  async function getReadiness(req, res) {
    const checklist = await model.getReadinessByTripId(req.params.tripId, actorId(req));
    sendData(res, 200, checklist);
  }

  async function updateReadiness(req, res) {
    const checklist = await model.updateReadinessItem(
      req.params.tripId,
      actorId(req),
      req.support.itemKey,
      req.support.completed,
    );
    sendData(res, 200, checklist);
  }

  async function createTicket(req, res) {
    const ticket = await model.createTicket({
      ownerId: actorId(req),
      tripId: req.support.tripId,
      category: req.support.category,
      message: req.support.message,
    });
    sendData(res, 201, { ticket: toTravelerTicket(ticket) });
  }

  async function listTickets(req, res) {
    const tickets = await model.getTicketsForUser(actorId(req));
    sendData(res, 200, { tickets: tickets.map(toTravelerTicket) });
  }

  async function getTicket(req, res) {
    const ticket = await model.getTicketById(req.params.ticketId, actorId(req));
    if (!ticket) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Support ticket not found.');
    }
    sendData(res, 200, { ticket: toTravelerTicket(ticket) });
  }

  async function listAdminTickets(req, res) {
    const tickets = await model.getTicketsForAdmin(req.support.status);
    sendData(res, 200, { tickets: tickets.map(toAdminTicket) });
  }

  async function getAdminTicket(req, res) {
    const ticket = await model.getAdminTicketById(req.params.ticketId);
    if (!ticket) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Support ticket not found.');
    }
    sendData(res, 200, { ticket: toAdminTicket(ticket) });
  }

  async function updateAdminTicket(req, res) {
    const current = await model.getAdminTicketById(req.params.ticketId);
    if (!current) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Support ticket not found.');
    }
    const plan = planAdminTicketChange(current, req.support);
    if (plan.unchanged) {
      sendData(res, 200, { ticket: toAdminTicket(current) });
      return;
    }
    const updated = await model.updateTicketStatus({
      ticketId: current.id,
      actorId: actorId(req),
      previousStatus: current.status,
      previousResolutionNote: current.resolutionNote,
      status: plan.status,
      resolutionNote: plan.resolutionNote,
      audits: plan.audits,
    });
    if (!updated) {
      throw new SupportHttpError(
        409,
        'INVALID_TRANSITION',
        'The ticket status changed before this update.',
      );
    }
    sendData(res, 200, { ticket: toAdminTicket(updated) });
  }

  async function getAdminAlternative(req, res) {
    const ticket = await model.getAdminTicketById(req.params.ticketId);
    if (!ticket) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Support ticket not found.');
    }
    const alternative = await model.getAlternativeByTicketId(ticket.id);
    if (!alternative) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'No alternative has been proposed.');
    }
    sendData(res, 200, { alternative: toPublicAlternative(alternative) });
  }

  async function createAdminAlternative(req, res) {
    const ticket = await model.getAdminTicketById(req.params.ticketId);
    const existing = ticket ? await model.getAlternativeByTicketId(ticket.id) : null;
    assertCanPropose(ticket, existing);
    const alternative = await model.createAlternative({
      ticketId: ticket.id,
      proposedBy: actorId(req),
      ...req.support,
    });
    sendData(res, 201, { alternative: toPublicAlternative(alternative) });
  }

  async function getTravelerAlternative(req, res) {
    const ticket = await model.getTicketById(req.params.ticketId, actorId(req));
    if (!ticket) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Support ticket not found.');
    }
    const alternative = await model.getAlternativeByTicketId(ticket.id);
    if (!alternative) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'No alternative has been proposed.');
    }
    sendData(res, 200, {
      alternative: toPublicAlternative(alternative),
      replacementExecutionRequired: alternative.status === 'accepted',
    });
  }

  async function decideTravelerAlternative(req, res) {
    const userId = actorId(req);
    const ticket = await model.getTicketById(req.params.ticketId, userId);
    if (!ticket) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Support ticket not found.');
    }
    const current = await model.getAlternativeByTicketId(ticket.id);
    const plan = planAlternativeDecision(current, req.support.decision);
    const result = await model.decideAlternative({
      ticketId: ticket.id,
      actorId: userId,
      decision: plan.decision,
      travelerNote: req.support.travelerNote,
    });
    if (result.reason === 'missing') {
      throw new SupportHttpError(404, 'NOT_FOUND', 'No alternative has been proposed.');
    }
    if (result.reason === 'decided' || !result.alternative) {
      throw new SupportHttpError(
        409,
        'CONFLICT',
        'This alternative has already been decided.',
      );
    }
    sendData(res, 200, {
      alternative: toPublicAlternative(result.alternative),
      replacementExecutionRequired: result.alternative.status === 'accepted',
      bookingMutated: false,
    });
  }

  async function exportTripSummary(req, res) {
    const trip = await model.getTripOverview(req.params.tripId, actorId(req));
    if (!trip) {
      throw new SupportHttpError(404, 'NOT_FOUND', 'Trip summary was not found.');
    }
    const userId = actorId(req);
    const checklist = await model.getReadinessByTripId(trip.id, userId);
    const counts = await model.getSupportStatusCounts(trip.id, userId);
    const html = renderTripSummaryHtml({
      tripName: trip.name,
      origin: trip.origin,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      travelerCount: trip.travelerCount,
      currency: trip.currency,
      bookingReferences: trip.bookingReferences,
      readiness: checklist.progress,
      support: {
        total: counts.total,
        byStatus: model.TICKET_STATUSES.map((status) => ({
          status,
          label: STATUS_LABELS[status],
          count: counts.counts[status],
        })),
      },
    });
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="tripnest-trip-summary.html"');
    res.set('Cache-Control', 'no-store');
    res.set('X-TripNest-Overview', trip.overviewSource);
    res.status(200).send(html);
  }

  return {
    SupportHttpError,
    allowedNextStatuses,
    assertCanPropose,
    createAdminAlternative,
    createTicket,
    decideTravelerAlternative,
    escapeHtml,
    exportTripSummary,
    getAdminAlternative,
    getAdminTicket,
    getReadiness,
    getTicket,
    getTravelerAlternative,
    isUuid,
    listAdminTickets,
    listTickets,
    parseAdminStatusFilter,
    parseAdminTicketPatch,
    parseAlternativeDecision,
    parseAlternativeProposal,
    parseCreateTicket,
    parseReadinessPatch,
    planAdminTicketChange,
    planAlternativeDecision,
    renderTripSummaryHtml,
    toPublicError,
    updateAdminTicket,
    updateReadiness,
  };
}
