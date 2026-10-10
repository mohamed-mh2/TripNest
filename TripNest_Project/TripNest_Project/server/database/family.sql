-- Mohamed mhamed: requests for simulated family support, kept separate from help tickets.
CREATE TABLE IF NOT EXISTS family_requests (
  id uuid PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES users(id),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 500 AND 500000),
  token_hash text NOT NULL UNIQUE,
  create_key uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  payer_id uuid REFERENCES users(id),
  payment_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  paid_at timestamptz,
  CHECK ((status='paid' AND payer_id IS NOT NULL AND payment_key IS NOT NULL AND paid_at IS NOT NULL AND payer_id<>recipient_id)
    OR (status<>'paid' AND payer_id IS NULL AND payment_key IS NULL AND paid_at IS NULL)),
  UNIQUE(recipient_id,create_key),
  UNIQUE(payer_id,payment_key)
);
CREATE INDEX IF NOT EXISTS family_requests_by_recipient ON family_requests(recipient_id,created_at DESC);
