// مسارات Express وطرق REST والتحقق من المدخلات واستدعاء وسيط المصادقة ثم controller الخاص بـ كتالوج الخدمات السبعة وإدارة العروض وعرض السعر والحجز والإلغاء التجريبي ومنع التكرار. المسؤول: abed alrahman.

import { Router } from 'express';

import { createBookingsController } from '../controllers/bookings.js';
import { requireSession } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { SERVICE_CATEGORIES } from '../utils/bookingPricing.js';
import { findDemoCard } from '../utils/demoPayment.js';

export function bookingRoutes(db, secret) {
  const router = Router();
  const controller = createBookingsController(db);
  const requireAuth = requireSession(db, secret);

  const SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc', 'rating', 'name'];
  const BOOKING_STATUSES = ['confirmed', 'cancelled'];

  // ---------- Input validation ----------

  function isUuid(value) {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    );
  }

  function isPositiveId(value) {
    return (
      /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= 2147483647
    );
  }

  // #explain_notes: Invalid ids are answered as "not found" so URLs never reach SQL with bad input.
  function requireIdParam(name) {
    return (req, res, next) => {
      if (
        !(name === 'serviceId'
          ? isPositiveId(req.params[name])
          : isUuid(req.params[name]))
      ) {
        return next(
          new HttpError(404, 'The requested resource was not found.', {
            code: 'NOT_FOUND',
          }),
        );
      }

      return next();
    };
  }

  function readOptionalWholeNumber(query, field, errors, max = 100000000) {
    if (query[field] === undefined || query[field] === '') {
      return undefined;
    }

    const value = Number(query[field]);

    if (!Number.isInteger(value) || value < 0 || value > max) {
      errors[field] = `${field} must be a whole number of 0 or more.`;
      return undefined;
    }

    return value;
  }

  function readOptionalText(query, field, errors) {
    const value = query[field];

    if (value === undefined || value === '') {
      return undefined;
    }

    if (typeof value !== 'string' || value.length > 100) {
      errors[field] = `${field} must be a short text value.`;
      return undefined;
    }

    return value.trim();
  }

  function validateServiceFilters(req, res, next) {
    const errors = {};
    const query = req.query;

    if (query.category !== undefined && !SERVICE_CATEGORIES.includes(query.category)) {
      errors.category = 'Unknown service category.';
    }

    if (query.sort !== undefined && !SORT_OPTIONS.includes(query.sort)) {
      errors.sort = 'Unknown sort option.';
    }

    const minRating =
      query.minRating === undefined || query.minRating === ''
        ? undefined
        : Number(query.minRating);

    if (
      minRating !== undefined &&
      (Number.isNaN(minRating) || minRating < 0 || minRating > 5)
    ) {
      errors.minRating = 'minRating must be between 0 and 5.';
    }

    const filters = {
      category: query.category,
      sort: query.sort,
      q: readOptionalText(query, 'q', errors),
      origin: readOptionalText(query, 'origin', errors),
      destination: readOptionalText(query, 'destination', errors),
      coverage: readOptionalText(query, 'coverage', errors),
      transferType: readOptionalText(query, 'transferType', errors),
      minStars: readOptionalWholeNumber(query, 'minStars', errors, 5),
      minDataGb: readOptionalWholeNumber(query, 'minDataGb', errors, 1000),
      minPriceMinor: readOptionalWholeNumber(query, 'minPriceMinor', errors),
      maxPriceMinor: readOptionalWholeNumber(query, 'maxPriceMinor', errors),
      minRating,
      freeCancellation: query.freeCancellation === 'true',
    };

    if (Object.keys(errors).length > 0) {
      return next(
        new HttpError(400, 'Some search filters are not valid.', {
          code: 'INVALID_FILTERS',
          fields: errors,
        }),
      );
    }

    req.serviceFilters = filters;
    return next();
  }

  function validateFacetQuery(req, res, next) {
    if (!SERVICE_CATEGORIES.includes(req.query.category)) {
      return next(
        new HttpError(400, 'Choose a valid service category.', {
          code: 'INVALID_FILTERS',
        }),
      );
    }

    return next();
  }

  function validateSelectionBody(req, res, next) {
    const selection = req.body && req.body.selection;

    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
      return next(
        new HttpError(422, 'Booking details are missing.', { code: 'INVALID_SELECTION' }),
      );
    }

    return next();
  }

  function validateCreateBooking(req, res, next) {
    const body = req.body || {};
    const errors = {};

    if (!isPositiveId(body.serviceId)) {
      errors.serviceId = 'Choose a service.';
    }

    if (!isUuid(body.tripId)) {
      errors.tripId = 'Choose one of your trips.';
    }

    if (
      !body.selection ||
      typeof body.selection !== 'object' ||
      Array.isArray(body.selection)
    ) {
      errors.selection = 'Booking details are missing.';
    }

    if (!findDemoCard(body.paymentCardId)) {
      errors.paymentCardId = 'Choose one of the demo payment cards.';
    }

    // #explain_notes: The client creates one random key per checkout; the server uses it to block duplicates.
    if (
      typeof body.idempotencyKey !== 'string' ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(body.idempotencyKey)
    ) {
      errors.idempotencyKey = 'A valid request key is required.';
    }

    if (!Number.isSafeInteger(body.expectedTotalMinor) || body.expectedTotalMinor < 0)
      errors.expectedTotalMinor = 'Review the current total before paying.';

    if (Object.keys(errors).length > 0) {
      return next(
        new HttpError(422, 'Please check the booking details.', {
          code: 'INVALID_BOOKING',
          fields: errors,
        }),
      );
    }

    req.body.serviceId = Number(body.serviceId);

    return next();
  }

  function validateBookingListQuery(req, res, next) {
    const { tripId, status } = req.query;

    if (tripId !== undefined && !isUuid(tripId)) {
      return next(
        new HttpError(400, 'tripId must be a valid id.', { code: 'INVALID_FILTERS' }),
      );
    }

    if (status !== undefined && !BOOKING_STATUSES.includes(status)) {
      return next(
        new HttpError(400, 'Unknown booking status.', { code: 'INVALID_FILTERS' }),
      );
    }

    return next();
  }

  // ---------- Catalog (public) ----------

  router.get('/services', validateServiceFilters, asyncHandler(controller.listServices));
  router.get(
    '/services/facets',
    validateFacetQuery,
    asyncHandler(controller.getServiceFacets),
  );
  router.get(
    '/services/:serviceId',
    requireIdParam('serviceId'),
    asyncHandler(controller.getService),
  );
  router.post(
    '/services/:serviceId/quote',
    requireIdParam('serviceId'),
    validateSelectionBody,
    asyncHandler(controller.quoteService),
  );

  // ---------- Bookings (signed-in customer only) ----------

  router.get(
    '/bookings/session',
    requireAuth,
    asyncHandler(controller.getBookingSession),
  );
  router.get('/bookings/payment-options', requireAuth, controller.getPaymentOptions);
  router.get(
    '/bookings',
    requireAuth,
    validateBookingListQuery,
    asyncHandler(controller.listMyBookings),
  );
  router.post(
    '/bookings',
    requireAuth,
    validateCreateBooking,
    asyncHandler(controller.createBooking),
  );
  router.get(
    '/bookings/trips/:tripId/summary',
    requireAuth,
    requireIdParam('tripId'),
    asyncHandler(controller.getTripBookingSummary),
  );
  router.get(
    '/bookings/:bookingId',
    requireAuth,
    requireIdParam('bookingId'),
    asyncHandler(controller.getMyBooking),
  );
  router.post(
    '/bookings/:bookingId/cancel',
    requireAuth,
    requireIdParam('bookingId'),
    asyncHandler(controller.cancelMyBooking),
  );

  return router;
}
