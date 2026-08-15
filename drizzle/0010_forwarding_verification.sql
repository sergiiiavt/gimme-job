CREATE TABLE IF NOT EXISTS email_forwarding_verifications (
  user_id TEXT PRIMARY KEY NOT NULL,
  verification_url TEXT,
  confirmation_code TEXT,
  received_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS email_forwarding_verifications_expires_at_idx
  ON email_forwarding_verifications(expires_at);
