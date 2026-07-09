CREATE TABLE IF NOT EXISTS friends (
    id TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    friend_user_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT friends_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friends_unique ON friends(owner_id, friend_user_id);
CREATE INDEX IF NOT EXISTS friends_owner_idx ON friends(owner_id);

ALTER TABLE friends ADD CONSTRAINT friends_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE friends ADD CONSTRAINT friends_friend_user_id_fkey FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE CASCADE;
