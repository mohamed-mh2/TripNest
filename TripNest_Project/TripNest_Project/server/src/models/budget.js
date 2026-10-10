import { randomUUID } from 'node:crypto';

export function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

export function createBudgetModel(db) {
  // #explain_notes: Check trip ownership before reading or changing its budget.

  async function withTrip(userId, tripId, work, writing = false) {
    const conn = await db.connect();
    try {
      await conn.query('BEGIN');
      const result = await conn.query(
        'SELECT * FROM trips WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [tripId, userId],
      );
      if (!result.rows.length) throw failure(404, 'Trip not found.');
      if (writing && result.rows[0].status === 'archived')
        throw failure(409, 'Archived trips cannot be edited.');
      const value = await work(conn, result.rows[0]);
      await conn.query('COMMIT');
      return value;
    } catch (error) {
      await conn.query('ROLLBACK');
      throw error;
    } finally {
      conn.release();
    }
  }

  async function snapshot(conn, trip) {
    const { rows } = await conn.query(
      'SELECT * FROM expenses WHERE trip_id=$1 ORDER BY id',
      [trip.id],
    );
    const bookings = await conn.query(
      'SELECT COALESCE(SUM(total_minor-refunded_minor),0) AS net FROM bookings WHERE trip_id=$1',
      [trip.id],
    );
    const bookingRows = await conn.query(
      `SELECT id,total_minor,refunded_minor,
        to_jsonb(b)->>'service_name' AS service_name,
        to_jsonb(b)->>'reference' AS reference,
        COALESCE(to_jsonb(b)->>'status','confirmed') AS status,
        to_jsonb(b)->>'category' AS category
       FROM bookings b WHERE trip_id=$1 ORDER BY id`,
      [trip.id],
    );

    const cancelled = new Set(
      bookingRows.rows.filter((b) => b.status === 'cancelled').map((b) => b.id),
    );
    // #explain_notes: A cancelled reservation no longer covers the planned expense.
    // Keep the original estimate and add any non-refundable booking remainder separately.
    const expenses = rows
      .filter((e) => e.kind === 'expected')
      .map((e) => ({
        ...e,
        booking_cancelled: cancelled.has(e.covered_by_booking_id),
        covered_by_booking_id: cancelled.has(e.covered_by_booking_id)
          ? null
          : e.covered_by_booking_id,
      }));
    const expensesMinor = expenses
      .filter((e) => !e.covered_by_booking_id)
      .reduce((n, e) => n + Number(e.amount_minor), 0);
    const reserveMinor = rows
      .filter((e) => e.kind === 'reserve')
      .reduce((n, e) => n + Number(e.amount_minor), 0);
    const bookedNetMinor = Number(bookings.rows[0].net);
    const totalMinor = expensesMinor + reserveMinor + bookedNetMinor;
    return {
      tripId: trip.id,
      title: trip.title,
      currency: trip.currency,
      budgetMinor: Number(trip.budget_minor),
      expensesMinor,
      reserveMinor,
      bookedNetMinor,
      bookings: bookingRows.rows.map((b) => ({
        id: b.id,
        serviceName: b.service_name,
        reference: b.reference,
        status: b.status,
        category: b.category,
        netMinor: Number(b.total_minor) - Number(b.refunded_minor),
      })),
      totalMinor,
      remainingMinor: Number(trip.budget_minor) - totalMinor,
      expenses: expenses.map((e) => ({
        id: e.id,
        label: e.label,
        amountMinor: Number(e.amount_minor),
        category: e.category,
        coveredByBookingId: e.covered_by_booking_id,
        bookingCancelled: e.booking_cancelled,
      })),
    };
  }
  return {
    read: (user, trip) => withTrip(user, trip, snapshot),
    plan: (user, trip, input) =>
      withTrip(
        user,
        trip,
        async (conn, row) => {
          await conn.query('UPDATE trips SET budget_minor=$1 WHERE id=$2', [
            input.budgetMinor,
            trip,
          ]);
          await conn.query(
            "INSERT INTO expenses(id,trip_id,label,amount_minor,kind,category) VALUES($1,$2,'Safety buffer',$3,'reserve','Other') ON CONFLICT(trip_id) WHERE kind='reserve' DO UPDATE SET amount_minor=EXCLUDED.amount_minor",
            [randomUUID(), trip, input.reserveMinor],
          );
          return snapshot(conn, { ...row, budget_minor: input.budgetMinor });
        },
        true,
      ),
    save: (user, trip, id, input) =>
      withTrip(
        user,
        trip,
        async (conn, row) => {
          if (input.coveredByBookingId) {
            const booking = await conn.query(
              "SELECT id FROM bookings b WHERE id=$1 AND trip_id=$2 AND COALESCE(to_jsonb(b)->>'status','confirmed') <> 'cancelled'",
              [input.coveredByBookingId, trip],
            );
            if (!booking.rows.length)
              throw failure(400, 'Choose a confirmed booking that belongs to this trip.');
          }
          if (id) {
            const updated = await conn.query(
              "UPDATE expenses SET label=$1,amount_minor=$2,category=$3,covered_by_booking_id=$4 WHERE id=$5 AND trip_id=$6 AND kind='expected' RETURNING id",
              [
                input.label,
                input.amountMinor,
                input.category,
                input.coveredByBookingId ?? null,
                id,
                trip,
              ],
            );
            if (!updated.rows.length) throw failure(404, 'Expense not found.');
          } else {
            const count = await conn.query(
              "SELECT count(*) FROM expenses WHERE trip_id=$1 AND kind='expected'",
              [trip],
            );
            if (Number(count.rows[0].count) >= 1000)
              throw failure(409, 'The trip supports up to 1,000 expenses.');
            await conn.query(
              "INSERT INTO expenses(id,trip_id,label,amount_minor,kind,category,covered_by_booking_id) VALUES($1,$2,$3,$4,'expected',$5,$6)",
              [
                input.id ?? randomUUID(),
                trip,
                input.label,
                input.amountMinor,
                input.category,
                input.coveredByBookingId ?? null,
              ],
            );
          }
          return snapshot(conn, row);
        },
        true,
      ),
    // #explain_notes: Save the whole forecast together; stable expense IDs make a network retry safe.
    importEstimates: (user, trip, input) =>
      withTrip(
        user,
        trip,
        async (conn, row) => {
          const ids = input.expenses.map((e) => e.id);
          const prior = await conn.query(
            'SELECT * FROM expenses WHERE id=ANY($1::uuid[])',
            [ids],
          );
          if (prior.rows.length) {
            const same =
              prior.rows.length === ids.length &&
              input.expenses.every((e) =>
                prior.rows.some(
                  (p) =>
                    p.id === e.id &&
                    p.trip_id === trip &&
                    p.kind === 'expected' &&
                    !p.covered_by_booking_id &&
                    p.label === e.label &&
                    p.category === e.category &&
                    Number(p.amount_minor) === e.amountMinor,
                ),
              );
            if (!same)
              throw failure(409, 'An estimate ID was already used for different data.');
            return snapshot(conn, row);
          }
          const current = await snapshot(conn, row);
          if (
            current.totalMinor !== input.expectedTotalMinor ||
            current.expenses.length !== input.expectedExpenseCount
          )
            throw failure(
              409,
              'The saved plan changed. Refresh it before adding an estimate.',
            );
          if (current.expenses.length + input.expenses.length > 1000)
            throw failure(409, 'The trip supports up to 1,000 expenses.');
          for (const expense of input.expenses) {
            await conn.query(
              "INSERT INTO expenses(id,trip_id,label,amount_minor,kind,category) VALUES($1,$2,$3,$4,'expected',$5)",
              [expense.id, trip, expense.label, expense.amountMinor, expense.category],
            );
          }
          return snapshot(conn, row);
        },
        true,
      ),

    remove: (user, trip, id) =>
      withTrip(
        user,
        trip,
        async (conn, row) => {
          const result = await conn.query(
            "DELETE FROM expenses WHERE trip_id=$1 AND id=$2 AND kind='expected' RETURNING id",
            [trip, id],
          );
          if (!result.rows.length) throw failure(404, 'Expense not found.');
          return snapshot(conn, row);
        },
        true,
      ),
  };
}
