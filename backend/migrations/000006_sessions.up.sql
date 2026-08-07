-- Sessions: what a login hands back and what every later request presents.
--
-- The table stores the SHA-256 of the bearer token, never the token itself —
-- the same rule email_verification_tokens follows — so the table on its own
-- can authenticate nobody. Logout deletes the row, which is why revocation is
-- instant and needs no denylist.

CREATE TABLE sessions (
    -- sha256 hex of the bearer token; the token is the key, so this is the PK.
    token_hash TEXT        PRIMARY KEY,
    user_id    TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Deleting a user must find their sessions without a scan.
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Lazy pruning deletes by expiry; without this it degrades into a full scan
-- precisely as the table grows.
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
