-- ============================================================================
-- products (UI "Module")
-- ============================================================================

-- name: CreateProduct :one
-- client_id is denormalised, so it is derived from the project rather than
-- taken from the caller: the two can never disagree, and a product can only
-- ever be reached (and cascaded) through the client that really owns it.
-- No matching project means no row, which the handler turns into a 400.
-- current_sprint_id is not settable here: a new product has no sprints, so any
-- value would point at another product's.
INSERT INTO products (
    id,
    project_id,
    client_id,
    name,
    goal,
    owner,
    delivery_lead,
    status,
    health,
    risk,
    velocity,
    blocked_count,
    ai_insight
)
SELECT
    sqlc.arg('id'),
    pj.id,
    pj.client_id,
    sqlc.arg('name'),
    sqlc.arg('goal'),
    sqlc.arg('owner'),
    sqlc.arg('delivery_lead'),
    sqlc.arg('status'),
    sqlc.arg('health'),
    sqlc.arg('risk'),
    sqlc.arg('velocity'),
    sqlc.arg('blocked_count'),
    sqlc.narg('ai_insight')::jsonb
FROM projects pj
WHERE pj.id = sqlc.arg('project_id')
RETURNING *;

-- name: GetProduct :one
SELECT * FROM products
WHERE id = $1;

-- name: ListProducts :many
SELECT * FROM products
ORDER BY created_at, name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ListProductsByProject :many
SELECT * FROM products
WHERE project_id = sqlc.arg('project_id')
ORDER BY created_at, name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ListProductsByClient :many
SELECT * FROM products
WHERE client_id = sqlc.arg('client_id')
ORDER BY created_at, name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateProduct :one
-- Partial update (see UpdateClient). client_id is never taken from the caller —
-- it always follows whichever project the row ends up on.
-- client_id is only recomputed when the product actually moves. Recomputing it
-- unconditionally raced with "project moved to another client": the subquery
-- read the pre-move snapshot while the row itself was re-read after the move,
-- and the composite foreign key rejected the mismatched pair — failing a PATCH
-- that never mentioned projectId.
UPDATE products p
SET
    project_id    = COALESCE(sqlc.narg('project_id'), p.project_id),
    client_id     = CASE
        WHEN sqlc.narg('project_id')::text IS NULL THEN p.client_id
        ELSE (SELECT pj.client_id FROM projects pj WHERE pj.id = sqlc.narg('project_id'))
    END,
    name          = COALESCE(sqlc.narg('name'), p.name),
    goal          = COALESCE(sqlc.narg('goal'), p.goal),
    owner         = COALESCE(sqlc.narg('owner'), p.owner),
    delivery_lead = COALESCE(sqlc.narg('delivery_lead'), p.delivery_lead),
    status        = COALESCE(sqlc.narg('status'), p.status),
    health        = COALESCE(sqlc.narg('health'), p.health),
    risk          = COALESCE(sqlc.narg('risk'), p.risk),
    velocity      = COALESCE(sqlc.narg('velocity'), p.velocity),
    blocked_count = COALESCE(sqlc.narg('blocked_count'), p.blocked_count),
    ai_insight    = COALESCE(sqlc.narg('ai_insight')::jsonb, p.ai_insight),
    updated_at    = now()
WHERE p.id = sqlc.arg('id')
RETURNING *;

-- name: SetProductCurrentSprint :one
-- The pointer may only name a sprint of this very product. A mismatch matches
-- no row, which the handler reports as a 400 rather than silently storing it.
UPDATE products p
SET
    current_sprint_id = sqlc.narg('current_sprint_id'),
    updated_at        = now()
WHERE p.id = sqlc.arg('id')
  AND (
      sqlc.narg('current_sprint_id')::text IS NULL
      OR EXISTS (
          SELECT 1 FROM sprints s
          WHERE s.id = sqlc.narg('current_sprint_id') AND s.product_id = p.id
      )
  )
RETURNING *;

-- name: DeleteProduct :exec
DELETE FROM products
WHERE id = $1;

-- ============================================================================
-- modules (UI "Component")
-- ============================================================================

-- name: CreateModule :one
-- position is chosen by the caller or computed under a row lock; see
-- LockProductForUpdate for why it cannot be computed inline.
INSERT INTO modules (
    id,
    product_id,
    name,
    owner,
    status,
    position
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: NextModulePosition :one
SELECT COALESCE(MAX(position), -1) + 1 AS next_position
FROM modules
WHERE product_id = $1;

-- name: GetModule :one
SELECT * FROM modules
WHERE id = $1;

-- name: ListModulesByProduct :many
SELECT * FROM modules
WHERE product_id = sqlc.arg('product_id')
ORDER BY position, name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateModule :one
UPDATE modules
SET
    name       = COALESCE(sqlc.narg('name'), name),
    owner      = COALESCE(sqlc.narg('owner'), owner),
    status     = COALESCE(sqlc.narg('status'), status),
    position   = COALESCE(sqlc.narg('position'), position),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateModuleStatus :one
UPDATE modules
SET
    status     = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteModule :exec
DELETE FROM modules
WHERE id = $1;
