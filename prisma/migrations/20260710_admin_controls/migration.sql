ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER NOT NULL DEFAULT 1,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT system_settings_pkey PRIMARY KEY (id),
    CONSTRAINT system_settings_singleton CHECK (id = 1)
);

INSERT INTO system_settings (id, maintenance_mode) VALUES (1, false) ON CONFLICT (id) DO NOTHING;
