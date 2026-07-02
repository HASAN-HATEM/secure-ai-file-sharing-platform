ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified              BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_verification_token    TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS utm_email                   TEXT,
  ADD COLUMN IF NOT EXISTS utm_verification_token      TEXT,
  ADD COLUMN IF NOT EXISTS utm_verification_pending_email TEXT,
  ADD COLUMN IF NOT EXISTS utm_verification_expires_at TIMESTAMPTZ;
