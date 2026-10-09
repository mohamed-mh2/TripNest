// استعلامات PostgreSQL المعلّمة المعاملات والمعاملات الذرية المطلوبة لـ قائمة الاستعداد وتصدير ملخص الرحلة وطلبات المساعدة ومعالجتها من المسؤول؛ خصائص eSIM والفعاليات تستخدم محرك الحجز المشترك؛ دون كود HTTP. المسؤول: mohamed fody.
"use strict";

const database = require("../db");

const READINESS_ITEM_KEYS = Object.freeze([
  "travel_documents",
  "flight_confirmation",
  "accommodation",
  "esim",
  "local_transport",
  "emergency_information",
]);

const READINESS_DEFINITIONS = Object.freeze({
  travel_documents: {
    title: "Travel documents",
    description: "Check your passport and required travel documents.",
  },
  flight_confirmation: {
    title: "Flight confirmation",
    description: "Make sure your flight booking is confirmed.",
  },
  accommodation: {
    title: "Accommodation",
    description: "Review your hotel or accommodation details.",
  },
  esim: {
    title: "eSIM",
    description: "Prepare mobile internet before arrival.",
  },
  local_transport: {
    title: "Local transport",
    description: "Plan transport from the airport and around the city.",
  },
  emergency_information: {
    title: "Emergency information",
    description: "Save useful contacts and important travel information.",
  },
});

const TICKET_STATUSES = Object.freeze(["open", "in_progress", "resolved", "closed"]);

const TICKET_CATEGORIES = Object.freeze([
  "transport",
  "accommodation",
  "booking",
  "esim",
  "activity",
  "other",
]);

const ALTERNATIVE_STATUSES = Object.freeze(["pending", "accepted", "rejected"]);

const TICKET_AUDIT_ACTIONS = new Set([
  "support_ticket_status_changed",
  "support_ticket_resolution_updated",
]);

const ALTERNATIVE_AUDIT_ACTIONS = new Set([
  "support_alternative_proposed",
  "support_alternative_accepted",
  "support_alternative_rejected",
]);

const AUDIT_METADATA_KEYS = new Set(["previousStatus", "newStatus", "decision", "ticketId"]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TICKET_COLUMNS = `
  id, trip_id, owner_id, booking_id, category, message, status,
  resolution_note, assigned_admin_id, created_at, updated_at
`;

const ALTERNATIVE_COLUMNS = `
  id, ticket_id, proposed_by, status, original_title, original_start_at, original_end_at,
  original_price_minor, alternative_title, alternative_start_at, alternative_end_at,
  alternative_price_minor, currency, traveler_note, proposed_at, decided_at, created_at, updated_at
`;

const DECIDE_ALTERNATIVE_SQL = `
  UPDATE support_alternatives
  SET status = $2,
      traveler_note = $3,
      decided_at = now(),
      updated_at = now()
  WHERE id = $1
    AND status = 'pending'
  RETURNING ${ALTERNATIVE_COLUMNS}
`;

class SupportDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SupportDataError";
    this.code = code;
  }
}

function assertUuid(value, label) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new SupportDataError("VALIDATION", `${label} must be a valid UUID.`);
  }
}

// Team db.js contract used here:
//   query(text, params) => Promise<{ rows: Array<object> }>
//   withTransaction(async (client) => ...) begins a transaction, commits on success, and rolls back when work throws.
// client.query has the same shape as query. Trip ownership remains in the trips module.
function connection() {
  if (
    !database ||
    typeof database.query !== "function" ||
    typeof database.withTransaction !== "function"
  ) {
    throw new SupportDataError("DB_UNAVAILABLE", "PostgreSQL connection is not configured.");
  }
  return database;
}

function normalizeDatabaseError(error) {
  if (error instanceof SupportDataError) {
    return error;
  }
  if (error && error.code === "23505") {
    return new SupportDataError("CONFLICT", "This ticket already has a pending alternative.");
  }
  if (error && error.code === "23514") {
    return new SupportDataError("VALIDATION", "The submitted value is not allowed.");
  }
  return new SupportDataError("DB_FAILURE", "Support data is unavailable.");
}

async function query(text, params) {
  try {
    return await connection().query(text, params);
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function withTransaction(work) {
  try {
    return await connection().withTransaction(async (client) => {
      if (!client || typeof client.query !== "function") {
        throw new SupportDataError("DB_UNAVAILABLE", "PostgreSQL connection is not configured.");
      }
      return work(client);
    });
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

function toIso(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function toMinor(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number)) {
    return null;
  }
  return number;
}

function sanitizeAuditMetadata(metadata) {
  const safe = {};
  if (!metadata || typeof metadata !== "object") {
    return safe;
  }
  for (const key of AUDIT_METADATA_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.length > 0 && value.length <= 80) {
      safe[key] = value;
    }
  }
  return safe;
}

function calculateReadinessProgress(items) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function buildReadinessChecklist(rows) {
  const savedByKey = new Map(rows.map((row) => [row.item_key, row]));
  const items = READINESS_ITEM_KEYS.map((key) => {
    const definition = READINESS_DEFINITIONS[key];
    const saved = savedByKey.get(key);
    const completedAt = saved ? toIso(saved.completed_at) : null;
    return {
      key,
      title: definition.title,
      description: definition.description,
      completed: completedAt !== null,
      completedAt,
    };
  });
  return {
    items,
    progress: calculateReadinessProgress(items),
  };
}

function mapTicket(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    tripId: row.trip_id,
    ownerId: row.owner_id,
    bookingId: row.booking_id,
    category: row.category,
    message: row.message,
    status: row.status,
    resolutionNote: row.resolution_note,
    assignedAdminId: row.assigned_admin_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAlternative(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    ticketId: row.ticket_id,
    proposedBy: row.proposed_by,
    status: row.status,
    originalTitle: row.original_title,
    originalStartAt: toIso(row.original_start_at),
    originalEndAt: toIso(row.original_end_at),
    originalPriceMinor: toMinor(row.original_price_minor),
    alternativeTitle: row.alternative_title,
    alternativeStartAt: toIso(row.alternative_start_at),
    alternativeEndAt: toIso(row.alternative_end_at),
    alternativePriceMinor: toMinor(row.alternative_price_minor),
    currency: row.currency,
    travelerNote: row.traveler_note,
    proposedAt: toIso(row.proposed_at),
    decidedAt: toIso(row.decided_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function assertOptionalTimestamp(value, label) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new SupportDataError("VALIDATION", `${label} must be an ISO timestamp or null.`);
  }
  return new Date(value).toISOString();
}

function assertOptionalPrice(value, label) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0 || value > 100000000) {
    throw new SupportDataError("VALIDATION", `${label} must be a non-negative minor-unit integer.`);
  }
  return value;
}

async function getReadinessByTripId(tripId, userId) {
  assertUuid(tripId, "tripId");
  assertUuid(userId, "userId");
  // Trip ownership is enforced by the trips module once that owner connects it.
  const result = await query(
    `SELECT item_key, completed_at
     FROM trip_checklist
     WHERE trip_id = $1`,
    [tripId],
  );
  return buildReadinessChecklist(result.rows);
}

async function updateReadinessItem(tripId, userId, itemKey, completed) {
  assertUuid(tripId, "tripId");
  assertUuid(userId, "userId");
  if (!READINESS_ITEM_KEYS.includes(itemKey)) {
    throw new SupportDataError("VALIDATION", "itemKey is not a readiness item.");
  }
  if (typeof completed !== "boolean") {
    throw new SupportDataError("VALIDATION", "completed must be true or false.");
  }
  await query(
    `INSERT INTO trip_checklist (trip_id, item_key, completed_at)
     VALUES ($1, $2, CASE WHEN $3::boolean THEN now() ELSE NULL END)
     ON CONFLICT (trip_id, item_key)
     DO UPDATE SET
       completed_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
       updated_at = now()`,
    [tripId, itemKey, completed],
  );
  return getReadinessByTripId(tripId, userId);
}

async function createTicket(input) {
  assertUuid(input.ownerId, "ownerId");
  assertUuid(input.tripId, "tripId");
  if (!TICKET_CATEGORIES.includes(input.category)) {
    throw new SupportDataError("VALIDATION", "category is not supported.");
  }
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length < 10 || message.length > 2000) {
    throw new SupportDataError("VALIDATION", "message must be between 10 and 2000 characters.");
  }
  const result = await query(
    `INSERT INTO support_tickets (trip_id, owner_id, category, message, status)
     VALUES ($1, $2, $3, $4, 'open')
     RETURNING ${TICKET_COLUMNS}`,
    [input.tripId, input.ownerId, input.category, message],
  );
  return mapTicket(result.rows[0]);
}

async function getTicketsForUser(userId) {
  assertUuid(userId, "userId");
  const result = await query(
    `SELECT ${TICKET_COLUMNS}
     FROM support_tickets
     WHERE owner_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(mapTicket);
}

async function getTicketById(ticketId, userId) {
  assertUuid(ticketId, "ticketId");
  assertUuid(userId, "userId");
  const result = await query(
    `SELECT ${TICKET_COLUMNS}
     FROM support_tickets
     WHERE id = $1 AND owner_id = $2`,
    [ticketId, userId],
  );
  return mapTicket(result.rows[0]);
}

async function getTicketsForAdmin(status) {
  if (status !== undefined && status !== null && !TICKET_STATUSES.includes(status)) {
    throw new SupportDataError("VALIDATION", "status is not supported.");
  }
  const result = status
    ? await query(
        `SELECT ${TICKET_COLUMNS}
         FROM support_tickets
         WHERE status = $1
         ORDER BY created_at DESC`,
        [status],
      )
    : await query(
        `SELECT ${TICKET_COLUMNS}
         FROM support_tickets
         ORDER BY created_at DESC`,
        [],
      );
  return result.rows.map(mapTicket);
}

async function getAdminTicketById(ticketId) {
  assertUuid(ticketId, "ticketId");
  const result = await query(
    `SELECT ${TICKET_COLUMNS}
     FROM support_tickets
     WHERE id = $1`,
    [ticketId],
  );
  return mapTicket(result.rows[0]);
}

async function updateTicketStatus(input) {
  assertUuid(input.ticketId, "ticketId");
  assertUuid(input.actorId, "actorId");
  if (!TICKET_STATUSES.includes(input.previousStatus) || !TICKET_STATUSES.includes(input.status)) {
    throw new SupportDataError("VALIDATION", "status is not supported.");
  }
  const audits = Array.isArray(input.audits) ? input.audits : [];
  return withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE support_tickets
       SET status = $2,
           resolution_note = $3,
           assigned_admin_id = $4,
           updated_at = now()
       WHERE id = $1 AND status = $5
       RETURNING ${TICKET_COLUMNS}`,
      [input.ticketId, input.status, input.resolutionNote, input.actorId, input.previousStatus],
    );
    if (!updated.rows[0]) {
      return null;
    }
    for (const audit of audits) {
      if (!TICKET_AUDIT_ACTIONS.has(audit.action)) {
        throw new SupportDataError("VALIDATION", "audit action is not supported.");
      }
      await client.query(
        `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'support_ticket', $3, $4::jsonb)`,
        [
          input.actorId,
          audit.action,
          input.ticketId,
          JSON.stringify(sanitizeAuditMetadata(audit.metadata)),
        ],
      );
    }
    return mapTicket(updated.rows[0]);
  });
}

async function getAlternativeByTicketId(ticketId) {
  assertUuid(ticketId, "ticketId");
  const result = await query(
    `SELECT ${ALTERNATIVE_COLUMNS}
     FROM support_alternatives
     WHERE ticket_id = $1
     ORDER BY proposed_at DESC
     LIMIT 1`,
    [ticketId],
  );
  return mapAlternative(result.rows[0]);
}

async function createAlternative(input) {
  assertUuid(input.ticketId, "ticketId");
  assertUuid(input.proposedBy, "proposedBy");
  const originalTitle = typeof input.originalTitle === "string" ? input.originalTitle.trim() : "";
  const alternativeTitle = typeof input.alternativeTitle === "string" ? input.alternativeTitle.trim() : "";
  if (originalTitle.length < 1 || originalTitle.length > 200) {
    throw new SupportDataError("VALIDATION", "originalTitle must be between 1 and 200 characters.");
  }
  if (alternativeTitle.length < 1 || alternativeTitle.length > 200) {
    throw new SupportDataError("VALIDATION", "alternativeTitle must be between 1 and 200 characters.");
  }
  const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "EUR";
  if (currency !== "EUR") {
    throw new SupportDataError("VALIDATION", "currency must be EUR.");
  }
  const values = {
    originalStartAt: assertOptionalTimestamp(input.originalStartAt, "originalStartAt"),
    originalEndAt: assertOptionalTimestamp(input.originalEndAt, "originalEndAt"),
    alternativeStartAt: assertOptionalTimestamp(input.alternativeStartAt, "alternativeStartAt"),
    alternativeEndAt: assertOptionalTimestamp(input.alternativeEndAt, "alternativeEndAt"),
    originalPriceMinor: assertOptionalPrice(input.originalPriceMinor, "originalPriceMinor"),
    alternativePriceMinor: assertOptionalPrice(input.alternativePriceMinor, "alternativePriceMinor"),
  };
  return withTransaction(async (client) => {
    const pending = await client.query(
      `SELECT id
       FROM support_alternatives
       WHERE ticket_id = $1 AND status = 'pending'
       LIMIT 1
       FOR UPDATE`,
      [input.ticketId],
    );
    if (pending.rows[0]) {
      throw new SupportDataError("CONFLICT", "This ticket already has a pending alternative.");
    }
    const created = await client.query(
      `INSERT INTO support_alternatives (
         ticket_id, proposed_by, status, original_title, original_start_at, original_end_at,
         original_price_minor, alternative_title, alternative_start_at, alternative_end_at,
         alternative_price_minor, currency
       )
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${ALTERNATIVE_COLUMNS}`,
      [
        input.ticketId,
        input.proposedBy,
        originalTitle,
        values.originalStartAt,
        values.originalEndAt,
        values.originalPriceMinor,
        alternativeTitle,
        values.alternativeStartAt,
        values.alternativeEndAt,
        values.alternativePriceMinor,
        currency,
      ],
    );
    const alternative = mapAlternative(created.rows[0]);
    await client.query(
      `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'support_alternative_proposed', 'support_alternative', $2, $3::jsonb)`,
      [input.proposedBy, alternative.id, JSON.stringify(sanitizeAuditMetadata({ ticketId: input.ticketId }))],
    );
    return alternative;
  });
}

async function decideAlternative(input) {
  assertUuid(input.ticketId, "ticketId");
  assertUuid(input.actorId, "actorId");
  if (input.decision !== "accepted" && input.decision !== "rejected") {
    throw new SupportDataError("VALIDATION", "decision must be accepted or rejected.");
  }
  const travelerNote =
    input.travelerNote === undefined || input.travelerNote === null
      ? null
      : String(input.travelerNote).trim();
  if (travelerNote && travelerNote.length > 2000) {
    throw new SupportDataError("VALIDATION", "travelerNote must be 2000 characters or fewer.");
  }
  const action =
    input.decision === "accepted" ? "support_alternative_accepted" : "support_alternative_rejected";
  if (!ALTERNATIVE_AUDIT_ACTIONS.has(action)) {
    throw new SupportDataError("VALIDATION", "audit action is not supported.");
  }
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, status
       FROM support_alternatives
       WHERE ticket_id = $1
       ORDER BY proposed_at DESC
       LIMIT 1
       FOR UPDATE`,
      [input.ticketId],
    );
    if (!current.rows[0]) {
      return { alternative: null, reason: "missing" };
    }
    const updated = await client.query(DECIDE_ALTERNATIVE_SQL, [
      current.rows[0].id,
      input.decision,
      travelerNote,
    ]);
    if (!updated.rows[0]) {
      return { alternative: null, reason: "decided" };
    }
    const alternative = mapAlternative(updated.rows[0]);
    await client.query(
      `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'support_alternative', $3, $4::jsonb)`,
      [
        input.actorId,
        action,
        alternative.id,
        JSON.stringify(sanitizeAuditMetadata({ decision: input.decision })),
      ],
    );
    return { alternative, reason: "updated" };
  });
}

async function getSupportStatusCounts(tripId, userId) {
  assertUuid(tripId, "tripId");
  assertUuid(userId, "userId");
  const result = await query(
    `SELECT status, COUNT(*)::int AS count
     FROM support_tickets
     WHERE trip_id = $1 AND owner_id = $2
     GROUP BY status`,
    [tripId, userId],
  );
  const counts = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  };
  for (const row of result.rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status] = Number(row.count) || 0;
    }
  }
  const total = TICKET_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  return { total, counts };
}

module.exports = {
  ALTERNATIVE_STATUSES,
  DECIDE_ALTERNATIVE_SQL,
  READINESS_DEFINITIONS,
  READINESS_ITEM_KEYS,
  SupportDataError,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  UUID_PATTERN,
  buildReadinessChecklist,
  calculateReadinessProgress,
  createAlternative,
  createTicket,
  decideAlternative,
  getAdminTicketById,
  getAlternativeByTicketId,
  getReadinessByTripId,
  getSupportStatusCounts,
  getTicketById,
  getTicketsForAdmin,
  getTicketsForUser,
  sanitizeAuditMetadata,
  updateReadinessItem,
  updateTicketStatus,
};
