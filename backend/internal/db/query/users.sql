-- Users: authentication accounts, distinct from members.
--
-- The password hash is confined to one query. Every read the API serialises
-- returns an explicit column list without it, so there is no path by which a
-- hash can be marshalled into a response; only GetUserForAuth selects it, and
-- its result is never written to the client.

-- name: CreateUser :one
INSERT INTO users (id, email, password_hash, name, role, member_id)
VALUES (
    sqlc.arg('id'),
    sqlc.arg('email'),
    sqlc.arg('password_hash'),
    sqlc.arg('name'),
    sqlc.arg('role'),
    sqlc.narg('member_id')
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
-- must never be serialised to a client.
SELECT id, email, password_hash, name, role, member_id, status
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
