-- Sprints, sprint membership, sprint backlog and the product backlog.
-- Naming note: products = UI "Module", modules = UI "Component".

-- ---------------------------------------------------------------- sprints ---

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
WHERE product_id = $1
ORDER BY number DESC;

-- name: ListSprintsByModule :many
SELECT * FROM sprints
WHERE module_id = $1
ORDER BY number DESC;

-- name: UpdateSprint :one
UPDATE sprints
SET module_id    = $2,
    number       = $3,
    name         = $4,
    goal         = $5,
    start_date   = $6,
    end_date     = $7,
    working_days = $8,
    days_left    = $9,
    status       = $10,
    committed    = $11,
    completed    = $12,
    progress     = $13,
    risk         = $14,
    updated_at   = now()
WHERE id = $1
RETURNING *;

-- name: DeleteSprint :exec
DELETE FROM sprints
WHERE id = $1;

-- name: NextSprintNumber :one
SELECT COALESCE(MAX(number), 0) + 1 AS next_number
FROM sprints
WHERE product_id = $1;

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
ORDER BY m.name ASC;

-- name: RemoveSprintMember :exec
DELETE FROM sprint_members
WHERE sprint_id = $1 AND member_id = $2;

-- --------------------------------------------------- sprint_backlog_items ---

-- name: AddSprintBacklogItem :one
INSERT INTO sprint_backlog_items (
    sprint_id,
    backlog_item_id,
    position
) VALUES (
    $1, $2, $3
)
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
ORDER BY sbi.position ASC, bi.title ASC;

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
WHERE product_id = $1
ORDER BY created_at DESC, id ASC;

-- name: ListBacklogItemsByModule :many
SELECT * FROM backlog_items
WHERE module_id = $1
ORDER BY created_at DESC, id ASC;

-- name: UpdateBacklogItem :one
UPDATE backlog_items
SET module_id           = $2,
    title               = $3,
    story               = $4,
    acceptance_criteria = $5,
    type                = $6,
    priority            = $7,
    readiness           = $8,
    estimate            = $9,
    ai_suggestions      = $10,
    updated_at          = now()
WHERE id = $1
RETURNING *;

-- name: DeleteBacklogItem :exec
DELETE FROM backlog_items
WHERE id = $1;
