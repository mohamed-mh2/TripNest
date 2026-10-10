// استعلامات PostgreSQL المعلّمة المعاملات والمعاملات الذرية المطلوبة لـ كتالوج الخدمات السبعة وإدارة العروض وعرض السعر والحجز والإلغاء التجريبي ومنع التكرار؛ دون كود HTTP. المسؤول: abed alrahman.

export function createBookingsModel(db) {
  const SERVICE_SORTS = {
    recommended: 'rating DESC, unit_price_minor ASC, id ASC',
    price_asc: 'unit_price_minor ASC, id ASC',
    price_desc: 'unit_price_minor DESC, id ASC',
    rating: 'rating DESC, id ASC',
    name: 'name ASC, id ASC',
  };

  function escapeLike(text) {
    return text.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  // #explain_notes: Filters become numbered placeholders ($1, $2...) so user input is never put inside SQL text.
  async function listServices(filters) {
    const conditions = ['is_active = TRUE'];
    const params = [];

    function addCondition(buildSql, value) {
      params.push(value);
      conditions.push(buildSql(`$${params.length}`));
    }

    if (filters.category) {
      addCondition((p) => `category = ${p}`, filters.category);
    }

    if (filters.q) {
      addCondition(
        (p) => `(name ILIKE ${p} OR provider_name ILIKE ${p} OR description ILIKE ${p})`,
        `%${escapeLike(filters.q)}%`,
      );
    }

    if (filters.origin) {
      addCondition((p) => `attributes->>'origin' = ${p}`, filters.origin);
    }

    if (filters.destination) {
      addCondition((p) => `attributes->>'destination' = ${p}`, filters.destination);
    }

    if (filters.coverage) {
      addCondition((p) => `attributes->>'coverage' = ${p}`, filters.coverage);
    }

    if (filters.transferType) {
      addCondition((p) => `attributes->>'transferType' = ${p}`, filters.transferType);
    }

    if (filters.minStars !== undefined) {
      addCondition(
        (p) => `CAST(attributes->>'stars' AS INTEGER) >= ${p}`,
        filters.minStars,
      );
    }

    if (filters.minDataGb !== undefined) {
      // #explain_notes: A null dataGb means unlimited data, which satisfies any minimum.
      addCondition(
        (p) =>
          `(attributes->>'dataGb' IS NULL OR CAST(attributes->>'dataGb' AS INTEGER) >= ${p})`,
        filters.minDataGb,
      );
    }

    if (filters.minPriceMinor !== undefined) {
      addCondition((p) => `unit_price_minor >= ${p}`, filters.minPriceMinor);
    }

    if (filters.maxPriceMinor !== undefined) {
      addCondition((p) => `unit_price_minor <= ${p}`, filters.maxPriceMinor);
    }

    if (filters.minRating !== undefined) {
      addCondition((p) => `rating >= ${p}`, filters.minRating);
    }

    if (filters.freeCancellation) {
      conditions.push('free_cancel_hours IS NOT NULL');
    }

    const orderBy = SERVICE_SORTS[filters.sort] || SERVICE_SORTS.recommended;

    const { rows } = await db.query(
      `SELECT * FROM services WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`,
      params,
    );

    return rows;
  }

  async function listServiceFacets(category) {
    const { rows } = await db.query(
      `SELECT
       attributes->>'origin' AS origin,
       attributes->>'destination' AS destination,
       attributes->>'coverage' AS coverage,
       attributes->>'transferType' AS transfer_type,
       unit_price_minor
     FROM services
     WHERE is_active = TRUE AND category = $1`,
      [category],
    );

    return rows;
  }

  async function findServiceById(serviceId, client = db) {
    const { rows } = await client.query(
      'SELECT * FROM services WHERE id = $1 AND is_active = TRUE',
      [serviceId],
    );

    return rows[0] || null;
  }

  // #explain_notes: Row lock so two bookings for the same service cannot both take the last seats.
  async function lockServiceForBooking(client, serviceId) {
    const { rows } = await client.query(
      'SELECT * FROM services WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [serviceId],
    );

    return rows[0] || null;
  }

  async function listConfirmedBookingsInRange(client, serviceId, firstDay, lastDay) {
    const { rows } = await client.query(
      `SELECT category, start_date, end_date, capacity_units
     FROM bookings
     WHERE service_id = $1
       AND status = 'confirmed'
       AND start_date <= $3
       AND end_date >= $2`,
      [serviceId, firstDay, lastDay],
    );

    return rows;
  }

  async function findBookingByIdempotencyKey(userId, idempotencyKey, client = db) {
    const { rows } = await client.query(
      `SELECT b.*, t.title AS trip_title
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     WHERE b.user_id = $1 AND b.idempotency_key = $2`,
      [userId, idempotencyKey],
    );

    return rows[0] || null;
  }

  async function findPaymentAttemptByKey(userId, idempotencyKey, client = db) {
    const { rows } = await client.query(
      'SELECT * FROM booking_payment_attempts WHERE user_id = $1 AND idempotency_key = $2',
      [userId, idempotencyKey],
    );

    return rows[0] || null;
  }

  async function insertPaymentAttempt(client, attempt) {
    const { rows } = await client.query(
      `INSERT INTO booking_payment_attempts
       (user_id, trip_id, service_id, booking_id, idempotency_key, outcome, amount_minor, currency, card_label, request_fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
      [
        attempt.userId,
        attempt.tripId,
        attempt.serviceId,
        attempt.bookingId,
        attempt.idempotencyKey,
        attempt.outcome,
        attempt.amountMinor,
        attempt.currency,
        attempt.cardLabel,
        attempt.requestFingerprint,
      ],
    );

    return rows[0];
  }

  async function insertBooking(client, booking) {
    const { rows } = await client.query(
      `INSERT INTO bookings
       (reference, user_id, trip_id, service_id, category, service_name, status,
        start_date, end_date, starts_at, travelers, rooms, quantity, capacity_units,
        unit_price_minor, subtotal_minor, taxes_minor, fees_minor, total_minor, refunded_minor,
        currency, free_cancel_hours, late_refund_percent, price_breakdown,
        payment_method, payment_reference, idempotency_key)
     VALUES
       ($1, $2, $3, $4, $5, $6, 'confirmed',
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, 0,
        $19, $20, $21, $22,
        $23, $24, $25)
     RETURNING *`,
      [
        booking.reference,
        booking.userId,
        booking.tripId,
        booking.serviceId,
        booking.category,
        booking.serviceName,
        booking.startDate,
        booking.endDate,
        booking.startsAt,
        booking.travelers,
        booking.rooms,
        booking.quantity,
        booking.capacityUnits,
        booking.unitPriceMinor,
        booking.subtotalMinor,
        booking.taxesMinor,
        booking.feesMinor,
        booking.totalMinor,
        booking.currency,
        booking.freeCancelHours,
        booking.lateRefundPercent,
        JSON.stringify(booking.priceBreakdown),
        booking.paymentMethod,
        booking.paymentReference,
        booking.idempotencyKey,
      ],
    );

    return rows[0];
  }

  async function listBookingsForUser(userId, filters = {}) {
    const conditions = ['b.user_id = $1', 'b.service_id IS NOT NULL'];
    const params = [userId];

    if (filters.tripId) {
      params.push(filters.tripId);
      conditions.push(`b.trip_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`b.status = $${params.length}`);
    }

    const { rows } = await db.query(
      `SELECT b.*, t.title AS trip_title
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY b.created_at DESC, b.id DESC`,
      params,
    );

    return rows;
  }

  // #explain_notes: Ownership is part of the WHERE clause, so another customer's booking is simply "not found".
  async function findBookingForUser(userId, bookingId, client = db) {
    const { rows } = await client.query(
      `SELECT b.*, t.title AS trip_title
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     WHERE b.id = $1 AND b.user_id = $2`,
      [bookingId, userId],
    );

    return rows[0] || null;
  }

  // #explain_notes: The status check in WHERE makes cancellation happen once: a repeated or
  // concurrent request updates no row, so the refund can never be applied twice.
  async function cancelConfirmedBooking(client, userId, bookingId, refundMinor) {
    const { rows } = await client.query(
      `UPDATE bookings
     SET status = 'cancelled', refunded_minor = $3, cancelled_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'confirmed'
     RETURNING *`,
      [bookingId, userId, refundMinor],
    );

    return rows[0] || null;
  }

  async function findTripBookingCosts(tripId) {
    const { rows } = await db.query(
      'SELECT * FROM trip_booking_costs WHERE trip_id = $1',
      [tripId],
    );

    return rows;
  }

  return {
    listServices,
    listServiceFacets,
    findServiceById,
    lockServiceForBooking,
    listConfirmedBookingsInRange,
    findBookingByIdempotencyKey,
    findPaymentAttemptByKey,
    insertPaymentAttempt,
    insertBooking,
    listBookingsForUser,
    findBookingForUser,
    cancelConfirmedBooking,
    findTripBookingCosts,
  };
}
