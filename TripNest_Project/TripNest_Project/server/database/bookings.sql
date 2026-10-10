-- #explain_notes: Extend the existing UUID schema; retain legacy bookings and finance records.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS destination_city TEXT NOT NULL DEFAULT '';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_date DATE;
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


ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travelers INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rooms INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS capacity_units INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_price_minor INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subtotal_minor INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS taxes_minor INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fees_minor INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS free_cancel_hours INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_refund_percent INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price_breakdown JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'demo_card';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ALTER COLUMN id SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS bookings_reference_unique ON bookings(reference);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_request_unique ON bookings(user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_service_date_idx ON bookings(service_id,start_date);
CREATE TABLE IF NOT EXISTS booking_payment_attempts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  trip_id UUID NOT NULL REFERENCES trips(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  booking_id UUID REFERENCES bookings(id),
  idempotency_key TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'declined')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  card_label TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
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
  COALESCE(SUM(total_minor), 0)::bigint AS booked_total_minor,
  COALESCE(SUM(refunded_minor), 0)::bigint AS refunded_minor,
  COALESCE(SUM(total_minor - refunded_minor), 0)::bigint AS net_minor
FROM bookings
GROUP BY trip_id, currency;
