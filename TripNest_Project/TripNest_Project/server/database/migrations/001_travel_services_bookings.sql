-- Travel services catalog and bookings (additive migration). المسؤول: abed alrahman.
-- #explain_notes: Every statement is additive (IF NOT EXISTS) so existing records are preserved.
-- Money is stored as integer minor units (cents). Shared fields for the cost planner:
-- bookings.id, bookings.trip_id, bookings.total_minor, bookings.refunded_minor.

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('flight', 'train', 'ferry', 'hotel', 'esim', 'transfer', 'activity')),
  name TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  city TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  price_unit TEXT NOT NULL CHECK (price_unit IN ('per_traveler', 'per_room_night', 'per_item', 'per_vehicle', 'per_ticket')),
  booking_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (booking_fee_minor >= 0),
  daily_capacity INTEGER,
  rating NUMERIC(2, 1) NOT NULL DEFAULT 4.0,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  free_cancel_hours INTEGER,
  late_refund_percent INTEGER NOT NULL DEFAULT 0 CHECK (late_refund_percent >= 0 AND late_refund_percent <= 100),
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS services_category_idx ON services (category);


CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  category TEXT NOT NULL,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  travelers INTEGER NOT NULL DEFAULT 1,
  rooms INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  capacity_units INTEGER NOT NULL DEFAULT 0,
  unit_price_minor INTEGER NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  taxes_minor INTEGER NOT NULL DEFAULT 0,
  fees_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  refunded_minor INTEGER NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  currency TEXT NOT NULL,
  free_cancel_hours INTEGER,
  late_refund_percent INTEGER NOT NULL DEFAULT 0,
  price_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_method TEXT NOT NULL DEFAULT 'demo_card',
  payment_reference TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT bookings_refund_not_above_total CHECK (refunded_minor <= total_minor),
  CONSTRAINT bookings_user_idempotency_key UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_trip_idx ON bookings (trip_id);
CREATE INDEX IF NOT EXISTS bookings_service_date_idx ON bookings (service_id, start_date);


-- #explain_notes: One row per payment attempt. Declined attempts are stored here only and never create a booking.
CREATE TABLE IF NOT EXISTS booking_payment_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  booking_id INTEGER REFERENCES bookings(id),
  idempotency_key TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'declined')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  card_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_payment_attempts_user_key UNIQUE (user_id, idempotency_key)
);


-- #explain_notes: Net booking cost per trip for the cost planner (Student 3).
-- Cancelled bookings still count their non-refunded remainder; a booking is never also an expense.
CREATE OR REPLACE VIEW trip_booking_costs AS
SELECT
  trip_id,
  currency,
  COUNT(*)::int AS booking_count,
  COALESCE(SUM(total_minor), 0)::int AS booked_total_minor,
  COALESCE(SUM(refunded_minor), 0)::int AS refunded_minor,
  COALESCE(SUM(total_minor - refunded_minor), 0)::int AS net_minor
FROM bookings
GROUP BY trip_id, currency;
