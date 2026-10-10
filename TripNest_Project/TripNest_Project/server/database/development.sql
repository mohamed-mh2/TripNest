-- Local integration scaffolding for student 1 (accounts/trips) and student 2 (bookings).
-- These minimal tables support isolated budget development, not finished account or booking features.
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, revoked_at timestamptz);
CREATE TABLE IF NOT EXISTS trips (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), title text NOT NULL, budget_minor bigint NOT NULL CHECK(budget_minor BETWEEN 0 AND 100000000), currency text NOT NULL CHECK(currency='EUR'), status text NOT NULL DEFAULT 'active');
CREATE TABLE IF NOT EXISTS bookings (id uuid PRIMARY KEY, trip_id uuid NOT NULL REFERENCES trips(id), total_minor bigint NOT NULL CHECK(total_minor>=0), refunded_minor bigint NOT NULL DEFAULT 0 CHECK(refunded_minor>=0 AND refunded_minor<=total_minor));
