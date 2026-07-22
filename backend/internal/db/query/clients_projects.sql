-- ---------------------------------------------------------------- clients ---

-- name: CreateClient :one
INSERT INTO clients (
    id,
    name,
    industry,
    status,
    client_pic,
    wit_owner,
    contract_type,
    health,
    risk,
    notes,
    action_needed,
    ai_insight
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
RETURNING *;

-- name: GetClient :one
SELECT * FROM clients
WHERE id = $1;

-- name: ListClients :many
SELECT * FROM clients
ORDER BY name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateClient :one
-- Partial update: a NULL argument means "not supplied", so a column nobody
-- named is never rewritten. Two concurrent PATCHes of different fields both
-- land instead of the second silently reverting the first.
UPDATE clients
SET
    name          = COALESCE(sqlc.narg('name'), name),
    industry      = COALESCE(sqlc.narg('industry'), industry),
    status        = COALESCE(sqlc.narg('status'), status),
    client_pic    = COALESCE(sqlc.narg('client_pic'), client_pic),
    wit_owner     = COALESCE(sqlc.narg('wit_owner'), wit_owner),
    contract_type = COALESCE(sqlc.narg('contract_type'), contract_type),
    health        = COALESCE(sqlc.narg('health'), health),
    risk          = COALESCE(sqlc.narg('risk'), risk),
    notes         = COALESCE(sqlc.narg('notes'), notes),
    action_needed = COALESCE(sqlc.narg('action_needed')::text[], action_needed),
    ai_insight    = COALESCE(sqlc.narg('ai_insight')::jsonb, ai_insight),
    updated_at    = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteClient :exec
DELETE FROM clients
WHERE id = $1;

-- --------------------------------------------------------------- projects ---

-- name: CreateProject :one
INSERT INTO projects (
    id,
    client_id,
    name,
    objective,
    status
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;

-- name: GetProject :one
SELECT * FROM projects
WHERE id = $1;

-- name: ListProjects :many
SELECT * FROM projects
ORDER BY name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ListProjectsByClient :many
SELECT * FROM projects
WHERE client_id = sqlc.arg('client_id')
ORDER BY name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateProject :one
UPDATE projects
SET
    client_id  = COALESCE(sqlc.narg('client_id'), client_id),
    name       = COALESCE(sqlc.narg('name'), name),
    objective  = COALESCE(sqlc.narg('objective'), objective),
    status     = COALESCE(sqlc.narg('status'), status),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteProject :exec
DELETE FROM projects
WHERE id = $1;
