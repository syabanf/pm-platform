-- ============================================================================
-- products (UI "Module")
-- ============================================================================

-- name: CreateProduct :one
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
    current_sprint_id,
    ai_insight
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
RETURNING *;

-- name: GetProduct :one
SELECT * FROM products
WHERE id = $1;

-- name: ListProducts :many
SELECT * FROM products
ORDER BY created_at, name;

-- name: ListProductsByProject :many
SELECT * FROM products
WHERE project_id = $1
ORDER BY created_at, name;

-- name: ListProductsByClient :many
SELECT * FROM products
WHERE client_id = $1
ORDER BY created_at, name;

-- name: UpdateProduct :one
UPDATE products
SET
    project_id    = $2,
    client_id     = $3,
    name          = $4,
    goal          = $5,
    owner         = $6,
    delivery_lead = $7,
    status        = $8,
    health        = $9,
    risk          = $10,
    velocity      = $11,
    blocked_count = $12,
    ai_insight    = $13,
    updated_at    = now()
WHERE id = $1
RETURNING *;

-- name: SetProductCurrentSprint :one
UPDATE products
SET
    current_sprint_id = $2,
    updated_at        = now()
WHERE id = $1
RETURNING *;

-- name: DeleteProduct :exec
DELETE FROM products
WHERE id = $1;

-- ============================================================================
-- modules (UI "Component")
-- ============================================================================

-- name: CreateModule :one
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

-- name: GetModule :one
SELECT * FROM modules
WHERE id = $1;

-- name: ListModulesByProduct :many
SELECT * FROM modules
WHERE product_id = $1
ORDER BY position, name;

-- name: UpdateModule :one
UPDATE modules
SET
    name       = $2,
    owner      = $3,
    status     = $4,
    position   = $5,
    updated_at = now()
WHERE id = $1
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
