-- Sprints, sprint membership, sprint backlog and the product backlog.
-- Naming note: products = UI "Module", modules = UI "Component".

-- ---------------------------------------------------------------- sprints ---

-- name: LockProductForUpdate :one
-- Serialises per-product sequencing (sprint numbers, component positions).
-- A single statement cannot do this for itself: under READ COMMITTED its
-- snapshot is fixed before any lock it takes, so concurrent statements all
-- read the same MAX() no matter how they queue. Taking the row lock in its own
-- statement, inside a transaction, is what makes the next read see the truth.
--
-- FOR NO KEY UPDATE, not FOR UPDATE: only the latter conflicts with the
-- FOR KEY SHARE that every child insert's foreign-key check takes, which would
-- freeze unrelated endpoints (backlog, decisions, explicitly-numbered sprints)
-- for as long as one sequencing transaction runs.
SELECT id FROM products
WHERE id = $1
FOR NO KEY UPDATE;

-- name: LockSprintForUpdate :one
SELECT id FROM sprints
WHERE id = $1
FOR NO KEY UPDATE;

-- name: LockBacklogItemForShare :one
-- Taken before the sprint lock so the ordering matches the cascade's:
-- DELETE FROM products reaches backlog_items before sprints, so locking the
-- sprint first and the item second is an AB-BA cycle that deadlocks every
-- concurrent parent delete.
SELECT id FROM backlog_items
WHERE id = $1
FOR KEY SHARE;

-- name: CreateSprint :one
INSERT INTO sprints (
    id,
    product_id,
    module_id,
    number,
    name,
    goal,
    start_date,
    end_date,
    working_days,
    days_left,
    status,
    committed,
    completed,
    progress,
    risk
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
)
RETURNING *;

-- name: GetSprint :one
SELECT * FROM sprints
WHERE id = $1;

-- name: ListSprintsByProduct :many
SELECT * FROM sprints
WHERE product_id = sqlc.arg('product_id')
ORDER BY number DESC, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ListSprintsByModule :many
-- number is only unique per product, so it cannot order a cross-product list
-- on its own.
SELECT * FROM sprints
WHERE module_id = sqlc.narg('module_id')
ORDER BY number DESC, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateSprint :one
-- Partial update (see UpdateClient).
UPDATE sprints
SET module_id    = COALESCE(sqlc.narg('module_id'), module_id),
    number       = COALESCE(sqlc.narg('number'), number),
    name         = COALESCE(sqlc.narg('name'), name),
    goal         = COALESCE(sqlc.narg('goal'), goal),
    start_date   = COALESCE(sqlc.narg('start_date'), start_date),
    end_date     = COALESCE(sqlc.narg('end_date'), end_date),
    working_days = COALESCE(sqlc.narg('working_days'), working_days),
    days_left    = COALESCE(sqlc.narg('days_left'), days_left),
    status       = COALESCE(sqlc.narg('status'), status),
    committed    = COALESCE(sqlc.narg('committed'), committed),
    completed    = COALESCE(sqlc.narg('completed'), completed),
    progress     = COALESCE(sqlc.narg('progress'), progress),
    risk         = COALESCE(sqlc.narg('risk'), risk),
    updated_at   = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteSprint :exec
DELETE FROM sprints
WHERE id = $1;

-- name: SetLockTimeout :exec
-- Bounds how long a sequencing transaction will queue on a contended row.
-- Without it one hot product can park every pool connection on the same lock
-- until statement_timeout fires, and reads of unrelated data starve behind it.
SET LOCAL lock_timeout = '250ms';

-- name: NextSprintNumber :one
SELECT COALESCE(MAX(number), 0) + 1 AS next_number
FROM sprints
WHERE product_id = $1;

-- name: NextSprintBacklogPosition :one
SELECT COALESCE(MAX(position), -1) + 1 AS next_position
FROM sprint_backlog_items
WHERE sprint_id = $1;

-- --------------------------------------------------------- sprint_members ---

-- name: AddSprintMember :one
INSERT INTO sprint_members (
    sprint_id,
    member_id,
    allocation,
    capacity_days
) VALUES (
    $1, $2, $3, $4
)
ON CONFLICT (sprint_id, member_id) DO UPDATE
SET allocation    = EXCLUDED.allocation,
    capacity_days = EXCLUDED.capacity_days
RETURNING *;

-- name: ListSprintMembers :many
SELECT sm.sprint_id,
       sm.member_id,
       sm.allocation,
       sm.capacity_days,
       m.name  AS member_name,
       m.email AS member_email,
       m.role  AS member_role,
       m.role_label AS member_role_label
FROM sprint_members sm
JOIN members m ON m.id = sm.member_id
WHERE sm.sprint_id = $1
ORDER BY m.name ASC, m.id ASC;

-- name: RemoveSprintMember :exec
DELETE FROM sprint_members
WHERE sprint_id = $1 AND member_id = $2;

-- --------------------------------------------------- sprint_backlog_items ---

-- name: AddSprintBacklogItem :one
-- The JOIN is the guard: an item may only be pulled into a sprint of its own
-- product. A cross-product id matches no row, which the handler reports as a
-- 400 — before, it linked happily and leaked the other product's story text.
-- The position is chosen by the caller or computed under a row lock; see
-- LockSprintForUpdate for why it cannot be computed inline.
INSERT INTO sprint_backlog_items (
    sprint_id,
    backlog_item_id,
    position
)
SELECT
    s.id,
    bi.id,
    sqlc.arg('position')
FROM sprints s
JOIN backlog_items bi
  ON bi.id = sqlc.arg('backlog_item_id')
 AND bi.product_id = s.product_id
WHERE s.id = sqlc.arg('sprint_id')
ON CONFLICT (sprint_id, backlog_item_id) DO UPDATE
SET position = EXCLUDED.position
RETURNING *;

-- name: ListSprintBacklogItems :many
SELECT sbi.sprint_id,
       sbi.backlog_item_id,
       sbi.position,
       bi.product_id,
       bi.module_id,
       bi.title,
       bi.story,
       bi.acceptance_criteria,
       bi.type,
       bi.priority,
       bi.readiness,
       bi.estimate,
       bi.ai_suggestions
FROM sprint_backlog_items sbi
JOIN backlog_items bi ON bi.id = sbi.backlog_item_id
WHERE sbi.sprint_id = $1
ORDER BY sbi.position ASC, bi.title ASC, bi.id ASC;

-- name: RemoveSprintBacklogItem :exec
DELETE FROM sprint_backlog_items
WHERE sprint_id = $1 AND backlog_item_id = $2;

-- ---------------------------------------------------------- backlog_items ---

-- name: CreateBacklogItem :one
INSERT INTO backlog_items (
    id,
    product_id,
    module_id,
    title,
    story,
    acceptance_criteria,
    type,
    priority,
    readiness,
    estimate,
    ai_suggestions
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING *;

-- name: GetBacklogItem :one
SELECT * FROM backlog_items
WHERE id = $1;

-- name: ListBacklogItemsByProduct :many
SELECT * FROM backlog_items
WHERE product_id = sqlc.arg('product_id')
ORDER BY created_at DESC, id ASC
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ListBacklogItemsByModule :many
SELECT * FROM backlog_items
WHERE module_id = sqlc.narg('module_id')
ORDER BY created_at DESC, id ASC
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateBacklogItem :one
-- Partial update (see UpdateClient).
UPDATE backlog_items
SET module_id           = COALESCE(sqlc.narg('module_id'), module_id),
    title               = COALESCE(sqlc.narg('title'), title),
    story               = COALESCE(sqlc.narg('story'), story),
    acceptance_criteria = COALESCE(sqlc.narg('acceptance_criteria')::text[], acceptance_criteria),
    type                = COALESCE(sqlc.narg('type'), type),
    priority            = COALESCE(sqlc.narg('priority'), priority),
    readiness           = COALESCE(sqlc.narg('readiness'), readiness),
    estimate            = COALESCE(sqlc.narg('estimate'), estimate),
    ai_suggestions      = COALESCE(sqlc.narg('ai_suggestions')::text[], ai_suggestions),
    updated_at          = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteBacklogItem :exec
DELETE FROM backlog_items
WHERE id = $1;
