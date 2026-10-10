-- Requires the team's users/trips/bookings schema; amounts are EUR cents.
CREATE TABLE IF NOT EXISTS expenses (
 id uuid PRIMARY KEY, trip_id uuid NOT NULL REFERENCES trips(id), label varchar(80) NOT NULL CHECK(length(trim(label))>0),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 0 AND 100000000),
 kind text NOT NULL CHECK(kind IN ('expected','reserve')),
 category text NOT NULL CHECK(category IN ('Transport','Accommodation','Food','Activities','Other')),
 covered_by_booking_id uuid REFERENCES bookings(id),
 CHECK(kind='reserve' OR amount_minor>0), CHECK(kind='expected' OR covered_by_booking_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_reserve_per_trip ON expenses(trip_id) WHERE kind='reserve';
CREATE INDEX IF NOT EXISTS expenses_by_trip ON expenses(trip_id);
