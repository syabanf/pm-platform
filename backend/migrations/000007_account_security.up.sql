-- Account security past first login: resetting a forgotten password, and
-- refusing an account that is being guessed at.

-- Password reset mirrors email verification exactly — a random token, only its
-- hash stored, single-use, time-boxed. The two never share a token, so a reset
-- link cannot verify an address or vice versa.
CREATE TABLE password_reset_tokens (
    token_hash  TEXT        PRIMARY KEY,
    user_id     TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);

-- Per-account lockout. The IP rate limiter is in-memory: it resets on restart
-- and is not shared across replicas, so it cannot by itself stop a slow
-- distributed guess at one account. These columns persist the count and the
-- lock, so the block survives both.
ALTER TABLE users
    ADD COLUMN failed_login_count INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN locked_until       TIMESTAMPTZ;
