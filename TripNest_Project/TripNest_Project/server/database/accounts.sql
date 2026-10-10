-- Madin Abed: account credentials and trip details extend the shared UUID tables.
-- #explain_notes: Existing demonstration users keep nullable credentials and all saved data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(lower(email)) WHERE email IS NOT NULL;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS traveler_count integer NOT NULL DEFAULT 1 CHECK(traveler_count BETWEEN 1 AND 20);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS trips_owner_status_idx ON trips(owner_id,status);
