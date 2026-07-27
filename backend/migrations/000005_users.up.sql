-- Authentication: a real users table, distinct from members.
--
-- members are a resource-planning entity — who can be assigned work, their
-- capacity and skills. A user is a login: an email, a password, and a role.
-- They are related but not the same, so a user optionally points at the member
-- it corresponds to rather than overloading one table with both jobs.
--
-- This is the first authentication the service has had; earlier rounds left it
-- out on purpose. It is deliberately minimal — credentials and a verify
-- endpoint, no sessions or tokens yet.

CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT        NOT NULL UNIQUE,
    -- A bcrypt hash, never the password. The column is wide enough for the
    -- 60-char bcrypt output with room to spare.
    password_hash TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    -- role names live in the roles table, seeded by 000004; the foreign key
    -- keeps a user from pointing at a role that does not exist.
    role          TEXT        NOT NULL DEFAULT 'member' REFERENCES roles (id),
    -- The member this login acts as, if any. SET NULL so removing the person
    -- does not remove the account.
    member_id     TEXT        REFERENCES members (id) ON DELETE SET NULL,
    -- 'pending' until the address is proven. Registration starts here and
    -- login refuses it, so an unverified address cannot be used to sign in.
    status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
    -- When the address was proven. NULL means it never was; the pair with
    -- status is deliberate — status can later be suspended without losing the
    -- fact that the address is real.
    email_verified_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_verified_status_check
        CHECK (status <> 'pending' OR email_verified_at IS NULL)
);
CREATE INDEX users_member_id_idx ON users (member_id);

-- ------------------------------------------------ email verification tokens ---
-- A token is stored as a SHA-256 hash for the same reason a password is: what
-- is in the table must not be usable to impersonate the mail that carried it.
-- Rows are kept after use so a consumed link can be told apart from an unknown
-- one, which is the difference between "already verified" and "bad link".
CREATE TABLE email_verification_tokens (
    token_hash TEXT        PRIMARY KEY,
    user_id    TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_tokens_user_id_idx ON email_verification_tokens (user_id);

-- The initial administrator, so a fresh deployment has someone who can sign in.
-- The hash is bcrypt(cost 10) of "wit-admin-changeme" — a DEFAULT that MUST be
-- changed on first use. It carries its own salt, so it verifies with
-- bcrypt.CompareHashAndPassword without any secret shared with this file.
-- Seeded already verified: it exists so someone can sign in on day one, and
-- there is no inbox to send a link to.
INSERT INTO users (id, email, password_hash, name, role, member_id, status, email_verified_at)
VALUES ('usr-admin', 'admin@wit.id',
        '$2a$10$ri3EraKDEjepi7sVhROqK.yg2twJ5Y/vKEOOsetJ.6MDqIaCDSDFC',
        'WIT Admin', 'admin', 'mbr-owner', 'active', now())
ON CONFLICT (id) DO NOTHING;
