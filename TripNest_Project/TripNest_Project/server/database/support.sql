-- Mohamed Fody: readiness, help tickets, alternatives and support audit history.
-- Additive migration: existing trips, bookings and finance records stay intact.
CREATE TABLE IF NOT EXISTS support_agents (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS trip_checklist (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_key text NOT NULL CHECK (item_key IN ('travel_documents','flight_confirmation','accommodation','esim','local_transport','emergency_information')),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(trip_id,item_key)
);
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id),
  owner_id uuid NOT NULL REFERENCES users(id),
  booking_id uuid REFERENCES bookings(id),
  category text NOT NULL CHECK (category IN ('transport','accommodation','booking','esim','activity','other')),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  resolution_note text,
  assigned_admin_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'resolved' OR (resolution_note IS NOT NULL AND length(btrim(resolution_note)) >= 10))
);
CREATE INDEX IF NOT EXISTS support_tickets_owner ON support_tickets(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_queue ON support_tickets(status,created_at DESC);
CREATE TABLE IF NOT EXISTS support_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id),
  proposed_by uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  original_title text NOT NULL CHECK (length(btrim(original_title)) BETWEEN 1 AND 200),
  original_start_at timestamptz, original_end_at timestamptz,
  original_price_minor integer CHECK (original_price_minor BETWEEN 0 AND 100000000),
  alternative_title text NOT NULL CHECK (length(btrim(alternative_title)) BETWEEN 1 AND 200),
  alternative_start_at timestamptz, alternative_end_at timestamptz,
  alternative_price_minor integer CHECK (alternative_price_minor BETWEEN 0 AND 100000000),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency='EUR'),
  traveler_note text CHECK (length(traveler_note)<=2000),
  proposed_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (original_end_at IS NULL OR original_start_at IS NULL OR original_end_at>=original_start_at),
  CHECK (alternative_end_at IS NULL OR alternative_start_at IS NULL OR alternative_end_at>=alternative_start_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS support_one_pending_alternative ON support_alternatives(ticket_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS support_alternatives_latest ON support_alternatives(ticket_id,proposed_at DESC);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
