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
ORDER BY name;

-- name: UpdateClient :one
UPDATE clients
SET
    name          = $2,
    industry      = $3,
    status        = $4,
    client_pic    = $5,
    wit_owner     = $6,
    contract_type = $7,
    health        = $8,
    risk          = $9,
    notes         = $10,
    action_needed = $11,
    ai_insight    = $12,
    updated_at    = now()
WHERE id = $1
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
ORDER BY name;

-- name: ListProjectsByClient :many
SELECT * FROM projects
WHERE client_id = $1
ORDER BY name;

-- name: UpdateProject :one
UPDATE projects
SET
    client_id  = $2,
    name       = $3,
    objective  = $4,
    status     = $5,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteProject :exec
DELETE FROM projects
WHERE id = $1;
