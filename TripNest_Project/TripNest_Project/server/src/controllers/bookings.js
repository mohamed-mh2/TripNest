// معالجة الطلبات وقواعد العمل والاستجابات والأخطاء الخاصة بـ كتالوج الخدمات السبعة وإدارة العروض وعرض السعر والحجز والإلغاء التجريبي ومنع التكرار؛ استخدام models للوصول إلى البيانات. المسؤول: abed alrahman.

const db = require('../db');
const bookingsModel = require('../models/bookings');
const tripsModel = require('../models/trips');
const { HttpError } = require('../utils/httpError');
const { toDateString, addDays } = require('../utils/dates');
const { calculateQuote, UNIT_LABELS } = require('../utils/bookingPricing');
const { describePolicy, freeCancelDeadline, calculateRefund } = require('../utils/cancellationPolicy');
const {
  DEMO_PAYMENT_CARDS,
  findDemoCard,
  simulatePayment,
  createBookingReference,
} = require('../utils/demoPayment');


// ---------- Response mapping ----------

function mapService(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    providerName: row.provider_name,
    city: row.city,
    description: row.description,
    unitPriceMinor: row.unit_price_minor,
    currency: row.currency,
    priceUnit: row.price_unit,
    unitLabel: UNIT_LABELS[row.price_unit],
    bookingFeeMinor: row.booking_fee_minor,
    dailyCapacity: row.daily_capacity,
    rating: Number(row.rating),
    attributes: row.attributes || {},
    isDemo: row.is_demo,
    cancellationPolicy: {
      freeCancelHours: row.free_cancel_hours,
      lateRefundPercent: row.late_refund_percent,
      summary: describePolicy(row.free_cancel_hours, row.late_refund_percent, row.booking_fee_minor),
    },
  };
}


function mapBooking(row, now = new Date()) {
  const deadline = freeCancelDeadline(row.starts_at, row.free_cancel_hours);
  const preview = calculateRefund(row, now);

  return {
    id: row.id,
    reference: row.reference,
    tripId: row.trip_id,
    tripTitle: row.trip_title,
    serviceId: row.service_id,
    category: row.category,
    serviceName: row.service_name,
    status: row.status,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    startsAt: new Date(row.starts_at).toISOString(),
    travelers: row.travelers,
    rooms: row.rooms,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    subtotalMinor: row.subtotal_minor,
    taxesMinor: row.taxes_minor,
    feesMinor: row.fees_minor,
    totalMinor: row.total_minor,
    refundedMinor: row.refunded_minor,
    netMinor: row.total_minor - row.refunded_minor,
    currency: row.currency,
    priceBreakdown: row.price_breakdown || {},
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    isDemo: true,
    createdAt: new Date(row.created_at).toISOString(),
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
    cancellationPolicy: {
      freeCancelHours: row.free_cancel_hours,
      lateRefundPercent: row.late_refund_percent,
      freeCancelUntil: deadline ? deadline.toISOString() : null,
      summary: describePolicy(row.free_cancel_hours, row.late_refund_percent, row.fees_minor),
    },
    cancellationPreview: {
      canCancel: preview.canCancel,
      refundMinor: preview.refundMinor,
      refundPercent: preview.refundPercent,
      reason: preview.reason,
    },
  };
}


// ---------- Availability ----------

// #explain_notes: A hotel occupies each night from check-in up to (not including) check-out;
// other services occupy only their start date.
function occupiedDays(category, startDate, endDate) {
  if (category !== 'hotel') {
    return [startDate];
  }

  const days = [];

  for (let day = startDate; day < endDate; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
}


async function findRemainingCapacity(client, service, quote) {
  if (service.daily_capacity === null) {
    return null;
  }

  const days = occupiedDays(service.category, quote.startDate, quote.endDate);
  const existing = await bookingsModel.listConfirmedBookingsInRange(
    client,
    service.id,
    days[0],
    days[days.length - 1],
  );

  let busiestDayUsage = 0;

  for (const day of days) {
    const usedOnDay = existing
      .filter((booking) => occupiedDays(
        booking.category,
        toDateString(booking.start_date),
        toDateString(booking.end_date),
      ).includes(day))
      .reduce((sum, booking) => sum + booking.capacity_units, 0);

    busiestDayUsage = Math.max(busiestDayUsage, usedOnDay);
  }

  return Math.max(service.daily_capacity - busiestDayUsage, 0);
}


function assertWithinTrip(trip, quote) {
  const tripStart = toDateString(trip.start_date);
  const tripEnd = toDateString(trip.end_date);

  if (quote.startDate < tripStart || quote.endDate > tripEnd) {
    const field = quote.category === 'hotel' ? 'checkIn' : 'date';

    throw new HttpError(422, `Choose dates within your trip (${tripStart} to ${tripEnd}).`, {
      code: 'OUTSIDE_TRIP_DATES',
      fields: { [field]: `Must be between ${tripStart} and ${tripEnd}.` },
    });
  }
}


// ---------- Catalog ----------

async function listServices(req, res) {
  const rows = await bookingsModel.listServices(req.serviceFilters);

  res.json({ services: rows.map(mapService) });
}


function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}


async function getServiceFacets(req, res) {
  const rows = await bookingsModel.listServiceFacets(req.query.category);
  const prices = rows.map((row) => row.unit_price_minor);

  res.json({
    origins: uniqueSorted(rows.map((row) => row.origin)),
    destinations: uniqueSorted(rows.map((row) => row.destination)),
    coverages: uniqueSorted(rows.map((row) => row.coverage)),
    transferTypes: uniqueSorted(rows.map((row) => row.transfer_type)),
    minPriceMinor: prices.length ? Math.min(...prices) : 0,
    maxPriceMinor: prices.length ? Math.max(...prices) : 0,
  });
}


async function getService(req, res) {
  const service = await bookingsModel.findServiceById(req.params.serviceId);

  if (!service) {
    throw new HttpError(404, 'This service is not available.', { code: 'SERVICE_NOT_FOUND' });
  }

  res.json({ service: mapService(service) });
}


async function quoteService(req, res) {
  const service = await bookingsModel.findServiceById(req.params.serviceId);

  if (!service) {
    throw new HttpError(404, 'This service is not available.', { code: 'SERVICE_NOT_FOUND' });
  }

  const { errors, quote } = calculateQuote(service, req.body.selection);

  if (errors) {
    throw new HttpError(422, 'Please check the highlighted fields.', { code: 'INVALID_SELECTION', fields: errors });
  }

  const remaining = await findRemainingCapacity(db, service, quote);

  res.json({
    quote,
    availability: {
      remaining,
      isAvailable: remaining === null || remaining >= quote.capacityUnits,
    },
  });
}


function getPaymentOptions(req, res) {
  res.json({
    isSimulation: true,
    cards: DEMO_PAYMENT_CARDS.map((card) => ({
      id: card.id,
      label: card.label,
      description: card.description,
    })),
  });
}


// ---------- Booking ----------

// #explain_notes: A retry with the same idempotency key returns the first result instead of booking again.
async function findPreviousResult(userId, idempotencyKey) {
  const booking = await bookingsModel.findBookingByIdempotencyKey(userId, idempotencyKey);

  if (booking) {
    return { booking };
  }

  const attempt = await bookingsModel.findPaymentAttemptByKey(userId, idempotencyKey);

  if (attempt && attempt.outcome === 'declined') {
    return { declinedAttempt: attempt };
  }

  return null;
}


function sendDeclined(res, details) {
  res.status(402).json({
    error: {
      message: 'The demo card was declined (simulation). No booking was created and nothing was charged.',
      code: 'PAYMENT_DECLINED',
      fields: null,
    },
    payment: {
      outcome: 'declined',
      cardLabel: details.cardLabel,
      amountMinor: details.amountMinor,
      currency: details.currency,
      isSimulation: true,
    },
  });
}


function sendPreviousResult(res, previous) {
  if (previous.booking) {
    return res.status(200).json({ booking: mapBooking(previous.booking), replayed: true });
  }

  return sendDeclined(res, {
    cardLabel: previous.declinedAttempt.card_label,
    amountMinor: previous.declinedAttempt.amount_minor,
    currency: previous.declinedAttempt.currency,
  });
}


async function createBooking(req, res) {
  const userId = req.user.id;
  const { serviceId, tripId, selection, paymentCardId, idempotencyKey } = req.body;

  const previous = await findPreviousResult(userId, idempotencyKey);

  if (previous) {
    return sendPreviousResult(res, previous);
  }

  // #explain_notes: Customers may only book against their own active trips.
  const trip = await tripsModel.findTripForUser(userId, tripId);

  if (!trip) {
    throw new HttpError(404, 'Trip not found. Choose one of your own trips.', { code: 'TRIP_NOT_FOUND' });
  }

  if (trip.status !== 'active') {
    throw new HttpError(409, 'This trip is archived and cannot receive new bookings.', { code: 'TRIP_ARCHIVED' });
  }

  const card = findDemoCard(paymentCardId);
  let outcome;

  try {
    // #explain_notes: Every check happens before any write, and all writes share one transaction.
    outcome = await db.withTransaction(async (client) => {
      const service = await bookingsModel.lockServiceForBooking(client, serviceId);

      if (!service) {
        throw new HttpError(404, 'This service is not available.', { code: 'SERVICE_NOT_FOUND' });
      }

      const { errors, quote } = calculateQuote(service, selection);

      if (errors) {
        throw new HttpError(422, 'Please check the highlighted fields.', { code: 'INVALID_SELECTION', fields: errors });
      }

      assertWithinTrip(trip, quote);

      if (service.currency !== trip.currency) {
        throw new HttpError(409, `This service is priced in ${service.currency}, but the trip uses ${trip.currency}.`, {
          code: 'CURRENCY_MISMATCH',
        });
      }

      const remaining = await findRemainingCapacity(client, service, quote);

      if (remaining !== null && quote.capacityUnits > remaining) {
        throw new HttpError(409, remaining > 0
          ? `Only ${remaining} left for the selected dates. Reduce the quantity or pick other dates.`
          : 'Sold out for the selected dates. Please pick other dates.', { code: 'SOLD_OUT' });
      }

      const payment = simulatePayment(card);

      const attempt = {
        userId,
        tripId,
        serviceId,
        idempotencyKey,
        amountMinor: quote.totalMinor,
        currency: quote.currency,
        cardLabel: card.label,
      };

      if (!payment.approved) {
        // #explain_notes: A declined payment records the attempt only. No booking row is created.
        await bookingsModel.insertPaymentAttempt(client, { ...attempt, bookingId: null, outcome: 'declined' });

        return { declined: true, ...attempt };
      }

      const booking = await bookingsModel.insertBooking(client, {
        reference: createBookingReference(),
        userId,
        tripId,
        serviceId,
        category: service.category,
        serviceName: service.name,
        startDate: quote.startDate,
        endDate: quote.endDate,
        startsAt: quote.startsAt,
        travelers: quote.travelers,
        rooms: quote.rooms,
        quantity: quote.quantity,
        capacityUnits: quote.capacityUnits,
        unitPriceMinor: quote.unitPriceMinor,
        subtotalMinor: quote.subtotalMinor,
        taxesMinor: quote.taxesMinor,
        feesMinor: quote.feesMinor,
        totalMinor: quote.totalMinor,
        currency: quote.currency,
        freeCancelHours: service.free_cancel_hours,
        lateRefundPercent: service.late_refund_percent,
        priceBreakdown: {
          lines: quote.lines,
          unitLabel: quote.unitLabel,
          nights: quote.nights,
          billableUnits: quote.billableUnits,
        },
        paymentMethod: card.id,
        paymentReference: payment.paymentReference,
        idempotencyKey,
      });

      await bookingsModel.insertPaymentAttempt(client, { ...attempt, bookingId: booking.id, outcome: 'approved' });

      return { bookingId: booking.id };
    });
  } catch (error) {
    // #explain_notes: Unique (user, idempotency key) violation means a parallel duplicate request
    // finished first; answer with that request's result instead of an error.
    if (error.code === '23505') {
      const winner = await findPreviousResult(userId, idempotencyKey);

      if (winner) {
        return sendPreviousResult(res, winner);
      }
    }

    throw error;
  }

  if (outcome.declined) {
    return sendDeclined(res, outcome);
  }

  const saved = await bookingsModel.findBookingForUser(userId, outcome.bookingId);

  return res.status(201).json({ booking: mapBooking(saved), replayed: false });
}


async function listMyBookings(req, res) {
  const rows = await bookingsModel.listBookingsForUser(req.user.id, {
    tripId: req.query.tripId ? Number(req.query.tripId) : null,
    status: req.query.status || null,
  });

  res.json({ bookings: rows.map((row) => mapBooking(row)) });
}


async function getMyBooking(req, res) {
  const booking = await bookingsModel.findBookingForUser(req.user.id, req.params.bookingId);

  if (!booking) {
    throw new HttpError(404, 'Booking not found.', { code: 'BOOKING_NOT_FOUND' });
  }

  res.json({ booking: mapBooking(booking) });
}


async function cancelMyBooking(req, res) {
  const userId = req.user.id;
  const bookingId = req.params.bookingId;

  const refund = await db.withTransaction(async (client) => {
    const booking = await bookingsModel.findBookingForUser(userId, bookingId, client);

    if (!booking) {
      throw new HttpError(404, 'Booking not found.', { code: 'BOOKING_NOT_FOUND' });
    }

    const preview = calculateRefund(booking);

    if (!preview.canCancel) {
      throw new HttpError(409, preview.reason, {
        code: booking.status === 'cancelled' ? 'ALREADY_CANCELLED' : 'NOT_CANCELLABLE',
      });
    }

    const updated = await bookingsModel.cancelConfirmedBooking(client, userId, bookingId, preview.refundMinor);

    if (!updated) {
      throw new HttpError(409, 'This booking is already cancelled.', { code: 'ALREADY_CANCELLED' });
    }

    return preview;
  });

  const saved = await bookingsModel.findBookingForUser(userId, bookingId);

  res.json({
    booking: mapBooking(saved),
    refund: {
      amountMinor: refund.refundMinor,
      percent: refund.refundPercent,
      reason: refund.reason,
      currency: saved.currency,
      isSimulation: true,
      note: 'Simulated refund to the demo card. No real money moves.',
    },
  });
}


// #explain_notes: Integration endpoint for the cost planner (Student 3): net = total - refunded.
async function getTripBookingSummary(req, res) {
  const trip = await tripsModel.findTripForUser(req.user.id, req.params.tripId);

  if (!trip) {
    throw new HttpError(404, 'Trip not found.', { code: 'TRIP_NOT_FOUND' });
  }

  const rows = await bookingsModel.findTripBookingCosts(trip.id);
  const tripCurrencyRow = rows.find((row) => row.currency === trip.currency);

  res.json({
    tripId: trip.id,
    currency: trip.currency,
    bookingCount: tripCurrencyRow ? tripCurrencyRow.booking_count : 0,
    bookedTotalMinor: tripCurrencyRow ? tripCurrencyRow.booked_total_minor : 0,
    refundedMinor: tripCurrencyRow ? tripCurrencyRow.refunded_minor : 0,
    netMinor: tripCurrencyRow ? tripCurrencyRow.net_minor : 0,
  });
}


module.exports = {
  listServices,
  getServiceFacets,
  getService,
  quoteService,
  getPaymentOptions,
  createBooking,
  listMyBookings,
  getMyBooking,
  cancelMyBooking,
  getTripBookingSummary,
};
