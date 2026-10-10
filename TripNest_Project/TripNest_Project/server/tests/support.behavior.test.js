import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSupportModel } from '../src/models/support.js';
import { createSupportController } from '../src/controllers/support.js';
const model = createSupportModel();
const controller = createSupportController(model);

test('readiness checklist always contains the six supported items', () => {
  const checklist = model.buildReadinessChecklist([
    { item_key: 'esim', completed_at: '2026-10-01T00:00:00.000Z' },
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

test('ticket transitions follow the support workflow', () => {
  assert.deepEqual(controller.allowedNextStatuses('open'), ['in_progress', 'closed']);
  assert.deepEqual(controller.allowedNextStatuses('in_progress'), ['resolved', 'closed']);
  assert.deepEqual(controller.allowedNextStatuses('resolved'), ['closed']);
  assert.deepEqual(controller.allowedNextStatuses('closed'), []);

  const started = controller.planAdminTicketChange(
    { status: 'open', resolutionNote: null },
    { status: 'in_progress' },
  );
  assert.equal(started.status, 'in_progress');
  assert.equal(started.audits[0].action, 'support_ticket_status_changed');
  assert.equal(started.audits[0].metadata.resolutionNote, undefined);

  assert.throws(
    () =>
      controller.planAdminTicketChange(
        { status: 'open', resolutionNote: null },
        { status: 'resolved' },
      ),
    (error) => error.status === 409 && error.code === 'INVALID_TRANSITION',
  );
  assert.throws(
    () =>
      controller.planAdminTicketChange(
        { status: 'in_progress', resolutionNote: null },
        { status: 'resolved' },
      ),
    (error) => error.status === 400 && error.code === 'INVALID_NOTE',
  );
  assert.throws(
    () =>
      controller.planAdminTicketChange(
        { status: 'closed', resolutionNote: 'Already closed.' },
        { status: 'open' },
      ),
    (error) => error.status === 409,
  );
});

test('accepting an alternative records the decision without changing a booking or the ticket', () => {
  const plan = controller.planAlternativeDecision({ status: 'pending' }, 'accepted');
  assert.equal(plan.replacementExecutionRequired, true);
  assert.equal(plan.bookingMutated, false);
  assert.equal(plan.ticketStatusChange, null);
  assert.equal(
    controller.planAlternativeDecision({ status: 'pending' }, 'rejected')
      .replacementExecutionRequired,
    false,
  );
  assert.throws(
    () => controller.planAlternativeDecision({ status: 'accepted' }, 'rejected'),
    (error) => error.status === 409,
  );
});

test('audit metadata keeps status facts and drops secrets', () => {
  const safe = model.sanitizeAuditMetadata({
    previousStatus: 'open',
    newStatus: 'in_progress',
    password: 'secret',
    token: 'jwt',
    assignedAdminId: '11111111-1111-4111-8111-111111111111',
    resolutionNote: 'private note',
  });
  assert.deepEqual(safe, { previousStatus: 'open', newStatus: 'in_progress' });
});

test('trip summary html escapes text and omits secrets', () => {
  const html = controller.renderTripSummaryHtml({
    tripName: '<script>alert("x")</script>',
    origin: 'Cairo',
    destination: 'Lisbon',
    startDate: '2026-10-12',
    endDate: '2026-10-16',
    travelerCount: 2,
    currency: 'EUR',
    bookingReferences: ['TN-DEMO-FLIGHT-1042'],
    readiness: { completed: 0, total: 6, percentage: 0 },
    support: {
      total: 1,
      byStatus: [{ status: 'open', label: 'Open', count: 1 }],
    },
  });
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Overview of your saved trip/);
  assert.match(html, /0 of 6 complete/);
  assert.equal(/password|assignedAdminId|authorization/i.test(html), false);
});

test('unexpected errors do not publish sql text', () => {
  const published = controller.toPublicError(
    new Error("select * from users where password = 'x'"),
  );
  assert.equal(published.status, 500);
  assert.equal(published.body.error.message.includes('select'), false);
  assert.equal(published.body.error.message.includes('password'), false);
});
