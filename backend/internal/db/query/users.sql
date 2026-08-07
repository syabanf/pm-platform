-- Users: authentication accounts, distinct from members.
--
-- The password hash is confined to one query. Every read the API serialises
-- returns an explicit column list without it, so there is no path by which a
-- hash can be marshalled into a response; only GetUserForAuth selects it, and
-- its result is never written to the client.

-- name: CreateUser :one
-- status is the caller's decision because the two callers mean different
-- things: self-registration starts 'pending' until the address is proven,
-- while an admin-created account is born 'active' — the admin is vouching for
-- it, and with no mailer a pending account created this way could never sign
-- in at all. email_verified_at stays NULL either way until a real verify.
INSERT INTO users (id, email, password_hash, name, role, member_id, status)
VALUES (
    sqlc.arg('id'),
    sqlc.arg('email'),
    sqlc.arg('password_hash'),
    sqlc.arg('name'),
    sqlc.arg('role'),
    sqlc.narg('member_id'),
    sqlc.arg('status')
)
RETURNING id, email, name, role, member_id, status, email_verified_at, created_at, updated_at;

-- name: GetUser :one
SELECT id, email, name, role, member_id, status, email_verified_at, created_at, updated_at
FROM users
WHERE id = $1;

-- name: ListUsers :many
SELECT id, email, name, role, member_id, status, email_verified_at, created_at, updated_at
FROM users
ORDER BY email, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: GetUserForAuth :one
-- The only query that returns the hash. Used to verify a password; its result
-- must never be serialised to a client. Also carries the lockout state so login
-- can refuse an account under a lock without a second round trip.
SELECT id, email, password_hash, name, role, member_id, status,
       failed_login_count, locked_until
FROM users
WHERE email = $1;

-- name: GetUserByEmail :one
SELECT id, email, name, role, member_id, status, email_verified_at
FROM users
WHERE email = $1;

-- ------------------------------------------------ email verification ---

-- name: CreateVerificationToken :one
INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
VALUES (sqlc.arg('token_hash'), sqlc.arg('user_id'), sqlc.arg('expires_at'))
RETURNING token_hash, user_id, expires_at, consumed_at, created_at;

-- name: GetVerificationToken :one
SELECT token_hash, user_id, expires_at, consumed_at
FROM email_verification_tokens
WHERE token_hash = $1;

-- name: ConsumeVerificationToken :one
-- Consuming is a conditional UPDATE, not a read-then-write: two clicks on the
-- same link race, and only the one that flips consumed_at from NULL matches a
-- row. The loser gets no row and is told the link is already used.
UPDATE email_verification_tokens
SET consumed_at = now()
WHERE token_hash = sqlc.arg('token_hash')
  AND consumed_at IS NULL
  AND expires_at > now()
RETURNING token_hash, user_id;

-- name: MarkUserVerified :one
UPDATE users
SET status            = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
    email_verified_at = COALESCE(email_verified_at, now()),
    updated_at        = now()
WHERE id = sqlc.arg('id')
RETURNING id, email, name, role, member_id, status, email_verified_at;

-- name: InvalidateUserVerificationTokens :exec
-- Called before issuing a new link, so an earlier mail cannot still be used.
UPDATE email_verification_tokens
SET consumed_at = now()
WHERE user_id = sqlc.arg('user_id') AND consumed_at IS NULL;

-- --------------------------------------------------------------- sessions ---

-- name: CreateSession :one
INSERT INTO sessions (token_hash, user_id, expires_at)
VALUES (sqlc.arg('token_hash'), sqlc.arg('user_id'), sqlc.arg('expires_at'))
RETURNING token_hash, user_id, created_at, expires_at;

-- name: GetSessionUser :one
-- The middleware query: one indexed lookup resolves the bearer token to the
-- user and the permissions of their role. Expiry is checked here rather than
-- in Go so an expired session and a bogus token are indistinguishable.
-- password_hash is deliberately not selected (see TestPasswordHashNeverSerialised).
SELECT u.id   AS user_id,
       u.email,
       u.name,
       u.role,
       u.member_id,
       r.permissions,
       s.expires_at
FROM sessions s
JOIN users u ON u.id = s.user_id
JOIN roles r ON r.id = u.role
WHERE s.token_hash = sqlc.arg('token_hash')
  AND s.expires_at > now();

-- name: DeleteSession :execrows
DELETE FROM sessions WHERE token_hash = sqlc.arg('token_hash');

-- name: DeleteExpiredSessions :execrows
DELETE FROM sessions WHERE expires_at <= now();

-- ------------------------------------------------------ password reset ---

-- name: CreatePasswordResetToken :one
INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
VALUES (sqlc.arg('token_hash'), sqlc.arg('user_id'), sqlc.arg('expires_at'))
RETURNING token_hash, user_id, expires_at, consumed_at, created_at;

-- name: InvalidateUserPasswordResetTokens :exec
-- A fresh request invalidates any outstanding link, so only the newest works.
UPDATE password_reset_tokens
SET consumed_at = now()
WHERE user_id = $1 AND consumed_at IS NULL;

-- name: ConsumePasswordResetToken :one
-- Single-use and time-boxed, same conditional-UPDATE race guard as email
-- verification: two submits of one link, only the first flips consumed_at.
UPDATE password_reset_tokens
SET consumed_at = now()
WHERE token_hash = sqlc.arg('token_hash')
  AND consumed_at IS NULL
  AND expires_at > now()
RETURNING token_hash, user_id;

-- name: SetUserPassword :exec
UPDATE users
SET password_hash = sqlc.arg('password_hash'),
    failed_login_count = 0,
    locked_until = NULL,
    updated_at = now()
WHERE id = sqlc.arg('id');

-- name: DeleteSessionsForUser :execrows
-- Every session for a user — "log out everywhere", and the clean slate a
-- password reset must leave (a stolen session must not outlive the reset).
DELETE FROM sessions WHERE user_id = sqlc.arg('user_id');

-- --------------------------------------------------------- login lockout ---

-- name: RecordFailedLogin :one
-- Count one failure and, at the threshold, set the lock. The CASE keeps it one
-- statement: no read-modify-write race between concurrent wrong guesses.
UPDATE users
SET failed_login_count = failed_login_count + 1,
    locked_until = CASE
        WHEN failed_login_count + 1 >= sqlc.arg('threshold')::int
        THEN now() + make_interval(secs => sqlc.arg('lock_seconds')::int)
        ELSE locked_until
    END
WHERE id = sqlc.arg('id')
RETURNING failed_login_count, locked_until;

-- name: ClearLoginFailures :exec
UPDATE users
SET failed_login_count = 0, locked_until = NULL
WHERE id = $1;
