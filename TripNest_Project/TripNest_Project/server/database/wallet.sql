-- Mohamed mhamed: simulated credit ledger. No card or banking data.
CREATE TABLE IF NOT EXISTS wallets (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL UNIQUE REFERENCES users(id),
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR')
);
CREATE TABLE IF NOT EXISTS wallet_entries (
 id uuid PRIMARY KEY,
 wallet_id uuid NOT NULL REFERENCES wallets(id),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 kind text NOT NULL CHECK(kind IN ('demo_topup','family_support')),
 request_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(wallet_id,request_key)
);
CREATE INDEX IF NOT EXISTS wallet_entries_by_wallet ON wallet_entries(wallet_id,created_at DESC);
