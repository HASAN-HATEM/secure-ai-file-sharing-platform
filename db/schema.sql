CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  key_salt BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  encrypted_blob BYTEA NOT NULL,
  iv TEXT NOT NULL,
  wrap_iv TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_permissions (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  can_download BOOLEAN DEFAULT TRUE,
  wrapped_key_for_user TEXT,
  wrap_iv_for_user TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(file_id, user_id)
);

CREATE TABLE IF NOT EXISTS scan_results (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  is_malicious BOOLEAN NOT NULL,
  score REAL,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classification_results (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  classifier_type TEXT NOT NULL,
  label TEXT,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

DO $$ BEGIN
  CREATE TYPE file_object_status AS ENUM ('PENDING', 'READY', 'QUARANTINED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS file_objects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  temp_key TEXT,
  storage_key TEXT UNIQUE,
  status file_object_status NOT NULL DEFAULT 'PENDING',
  scan_score REAL,
  scan_is_malicious BOOLEAN,
  scan_model_version TEXT,
  category_label TEXT,
  category_confidence REAL,
  enc_algo TEXT,
  enc_iv_base64 TEXT,
  enc_tag_base64 TEXT,
  enc_key_id TEXT,
  enc_dek_base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS file_objects_owner_status_idx ON file_objects(owner_id, status);
