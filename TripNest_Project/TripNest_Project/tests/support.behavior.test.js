// اختبارات سلوك الدعم والاستعداد الخاصة بمحمد فودي. المسؤول: mohamed fody.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const model = require(path.join(root, "server/src/models/support"));
const controller = require(path.join(root, "server/src/controllers/support"));

const modelSource = fs.readFileSync(path.join(root, "server/src/models/support.js"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "server/src/routes/support.js"), "utf8").replaceAll("\r\n", "\n");

test("readiness checklist always contains the six supported items", () => {
  const checklist = model.buildReadinessChecklist([
    { item_key: "esim", completed_at: "2026-10-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(
    checklist.items.map((item) => item.key),
    model.READINESS_ITEM_KEYS,
  );
  assert.equal(checklist.items[3].completed, true);
  assert.equal(checklist.progress.completed, 1);
  assert.equal(checklist.progress.total, 6);
  assert.equal(checklist.progress.percentage, 17);
});

test("ticket transitions follow the support workflow", () => {
  assert.deepEqual(controller.allowedNextStatuses("open"), ["in_progress", "closed"]);
  assert.deepEqual(controller.allowedNextStatuses("in_progress"), ["resolved", "closed"]);
  assert.deepEqual(controller.allowedNextStatuses("resolved"), ["closed"]);
  assert.deepEqual(controller.allowedNextStatuses("closed"), []);

  const started = controller.planAdminTicketChange(
    { status: "open", resolutionNote: null },
    { status: "in_progress" },
  );
  assert.equal(started.status, "in_progress");
  assert.equal(started.audits[0].action, "support_ticket_status_changed");
  assert.equal(started.audits[0].metadata.resolutionNote, undefined);

  assert.throws(
    () => controller.planAdminTicketChange({ status: "open", resolutionNote: null }, { status: "resolved" }),
    (error) => error.status === 409 && error.code === "INVALID_TRANSITION",
  );
  assert.throws(
    () => controller.planAdminTicketChange({ status: "in_progress", resolutionNote: null }, { status: "resolved" }),
    (error) => error.status === 400 && error.code === "INVALID_NOTE",
  );
  assert.throws(
    () =>
      controller.planAdminTicketChange(
        { status: "closed", resolutionNote: "Already closed." },
        { status: "open" },
      ),
    (error) => error.status === 409,
  );
});

test("accepting an alternative records the decision without changing a booking or the ticket", () => {
  const plan = controller.planAlternativeDecision({ status: "pending" }, "accepted");
  assert.equal(plan.replacementExecutionRequired, true);
  assert.equal(plan.bookingMutated, false);
  assert.equal(plan.ticketStatusChange, null);
  assert.equal(controller.planAlternativeDecision({ status: "pending" }, "rejected").replacementExecutionRequired, false);
  assert.throws(
    () => controller.planAlternativeDecision({ status: "accepted" }, "rejected"),
    (error) => error.status === 409,
  );
  assert.equal(model.DECIDE_ALTERNATIVE_SQL.includes("support_tickets"), false);
  assert.equal(model.DECIDE_ALTERNATIVE_SQL.includes("bookings"), false);
  assert.equal(modelSource.includes("UPDATE bookings"), false);
  assert.equal(modelSource.includes("INSERT INTO bookings"), false);
  assert.equal(/drizzle|@neondatabase|next\/server/i.test(modelSource), false);
});

test("audit metadata keeps status facts and drops secrets", () => {
  const safe = model.sanitizeAuditMetadata({
    previousStatus: "open",
    newStatus: "in_progress",
    password: "secret",
    token: "jwt",
    assignedAdminId: "11111111-1111-4111-8111-111111111111",
    resolutionNote: "private note",
  });
  assert.deepEqual(safe, { previousStatus: "open", newStatus: "in_progress" });
});

test("trip summary html escapes text and omits secrets", () => {
  const html = controller.renderTripSummaryHtml({
    tripName: '<script>alert("x")</script>',
    origin: "Cairo",
    destination: "Lisbon",
    startDate: "2026-10-12",
    endDate: "2026-10-16",
    travelerCount: 2,
    currency: "EUR",
    bookingReferences: ["TN-DEMO-FLIGHT-1042"],
    readiness: { completed: 0, total: 6, percentage: 0 },
    support: {
      total: 1,
      byStatus: [{ status: "open", label: "Open", count: 1 }],
    },
  });
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Development trip overview/);
  assert.match(html, /0 of 6 complete/);
  assert.equal(/password|assignedAdminId|authorization/i.test(html), false);
  assert.equal(controller.findDevelopmentTrip("not-a-trip"), null);
  assert.equal(controller.findDevelopmentTrip(controller.DEVELOPMENT_TRIP_ID).overviewSource, "development-fallback");
});

test("unexpected errors do not publish sql text", () => {
  const published = controller.toPublicError(new Error("select * from users where password = 'x'"));
  assert.equal(published.status, 500);
  assert.equal(published.body.error.message.includes("select"), false);
  assert.equal(published.body.error.message.includes("password"), false);
});

test("support routes expose the owned contract and call auth instead of inventing a user", () => {
  const paths = [
    'router.get(\n  "/readiness/:tripId"',
    'router.patch(\n  "/readiness/:tripId"',
    'router.get("/tickets"',
    'router.post("/tickets"',
    'router.get(\n  "/tickets/:ticketId"',
    'router.get("/admin/tickets"',
    'router.patch(\n  "/admin/tickets/:ticketId"',
    'router.get(\n  "/admin/tickets/:ticketId/alternative"',
    'router.post(\n  "/admin/tickets/:ticketId/alternative"',
    'router.get(\n  "/tickets/:ticketId/alternative"',
    'router.patch(\n  "/tickets/:ticketId/alternative"',
    'router.get(\n  "/trips/:tripId/export"',
  ];
  for (const pathPattern of paths) {
    assert.equal(routeSource.includes(pathPattern), true, pathPattern);
  }
  assert.equal(routeSource.includes("x-user-id"), false);
  assert.match(routeSource, /AUTH_NOT_CONNECTED/);
  assert.match(routeSource, /require\("\.\.\/middleware\/auth"\)/);
});
