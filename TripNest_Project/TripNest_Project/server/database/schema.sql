-- تعريف الجداول والعلاقات والقيود للمستخدمين والرحلات والعروض والأسعار والحجوزات والمصاريف ودفتر المحفظة وطلبات دعم الأهل وقائمة الاستعداد وتذاكر المساعدة. المسؤول: الفريق.

-- #explain_notes: Minimal shared core (users, trips) so the bookings module can run.
-- Owners (madin abed for accounts and trips) may extend these tables with additive ALTER statements.
-- Wallet, budget, expenses, and support tables are intentionally not defined here by Student 2.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trips_user_idx ON trips (user_id);
