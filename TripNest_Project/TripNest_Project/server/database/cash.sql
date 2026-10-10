-- Simulated cash vouchers, never real cash or payment instruments.
ALTER TABLE wallet_entries DROP CONSTRAINT IF EXISTS wallet_entries_amount_minor_check;
ALTER TABLE wallet_entries DROP CONSTRAINT IF EXISTS wallet_entries_kind_check;
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_amount_minor_check CHECK((kind='cash_purchase' AND amount_minor<0) OR (kind IN ('demo_topup','family_support','cash_to_wallet') AND amount_minor>0));
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_kind_check CHECK(kind IN ('demo_topup','family_support','cash_to_wallet','cash_purchase'));
CREATE TABLE IF NOT EXISTS cash_vouchers (
 id uuid PRIMARY KEY, buyer_id uuid NOT NULL REFERENCES users(id), package_id text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor IN (5000,10000,25000)),
 payment_method text NOT NULL CHECK(payment_method IN ('demo_card','wallet')),
 request_key uuid NOT NULL, code_hash text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','pickup_reserved','collected','wallet_credited')),
 claimed_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
 CHECK((status='ready' AND claimed_by IS NULL) OR (status<>'ready' AND claimed_by IS NOT NULL)),
 UNIQUE(buyer_id,request_key)
);
