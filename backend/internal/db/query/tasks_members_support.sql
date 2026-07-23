-- ------------------------------------------------------------------ tasks ---

-- name: CreateTask :one
-- The JOIN keeps a task inside its own product: the backlog item it implements
-- must belong to the product that owns the sprint. A mismatch matches no row,
-- which the handler reports as a 400.
INSERT INTO tasks (
    id,
    sprint_id,
    backlog_item_id,
    title,
    module_name,
    assignee_id,
    estimate,
    board_column,
    priority,
    blocked_reason,
    blocked_days,
    off_goal
)
SELECT
    sqlc.arg('id'),
    s.id,
    bi.id,
    sqlc.arg('title'),
    sqlc.arg('module_name'),
    sqlc.narg('assignee_id'),
    sqlc.arg('estimate'),
    sqlc.arg('board_column'),
    sqlc.arg('priority'),
    sqlc.narg('blocked_reason'),
    sqlc.narg('blocked_days'),
    sqlc.arg('off_goal')
FROM sprints s
JOIN backlog_items bi
  ON bi.id = sqlc.arg('backlog_item_id')
 AND bi.product_id = s.product_id
WHERE s.id = sqlc.arg('sprint_id')
RETURNING *;

-- name: GetTask :one
SELECT * FROM tasks
WHERE id = $1;

-- name: ListTasksBySprint :many
SELECT * FROM tasks
WHERE sprint_id = sqlc.arg('sprint_id')
ORDER BY created_at, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ListTasksByBacklogItem :many
SELECT * FROM tasks
WHERE backlog_item_id = $1
ORDER BY created_at, id;

-- name: UpdateTask :one
-- Partial update (see UpdateClient): moving a card and renaming it at the same
-- moment no longer cancel each other out.
UPDATE tasks
SET title           = COALESCE(sqlc.narg('title'), title),
    module_name     = COALESCE(sqlc.narg('module_name'), module_name),
    assignee_id     = COALESCE(sqlc.narg('assignee_id'), assignee_id),
    estimate        = COALESCE(sqlc.narg('estimate'), estimate),
    board_column    = COALESCE(sqlc.narg('board_column'), board_column),
    priority        = COALESCE(sqlc.narg('priority'), priority),
    blocked_reason  = COALESCE(sqlc.narg('blocked_reason'), blocked_reason),
    blocked_days    = COALESCE(sqlc.narg('blocked_days'), blocked_days),
    off_goal        = COALESCE(sqlc.narg('off_goal'), off_goal),
    updated_at      = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: MoveTask :one
UPDATE tasks
SET board_column = $2,
    updated_at   = now()
WHERE id = $1
RETURNING *;

-- name: DeleteTask :exec
DELETE FROM tasks
WHERE id = $1;

-- --------------------------------------------------------------- task_dod ---

-- name: SetTaskDodItem :one
INSERT INTO task_dod (task_id, position, label, done)
VALUES ($1, $2, $3, $4)
ON CONFLICT (task_id, position) DO UPDATE
SET label = EXCLUDED.label,
    done  = EXCLUDED.done
RETURNING *;

-- name: ListTaskDod :many
SELECT * FROM task_dod
WHERE task_id = sqlc.arg('task_id')
ORDER BY position
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ToggleTaskDodItem :one
UPDATE task_dod
SET done = NOT done
WHERE task_id = $1 AND position = $2
RETURNING *;

-- name: DeleteTaskDod :exec
DELETE FROM task_dod
WHERE task_id = $1;

-- ---------------------------------------------------------------- members ---

-- name: CreateMember :one
INSERT INTO members (
    id,
    name,
    email,
    role,
    role_label,
    skill_tags,
    allocation,
    capacity_days,
    workload,
    status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;

-- name: GetMember :one
SELECT * FROM members
WHERE id = $1;

-- name: ListMembers :many
SELECT * FROM members
ORDER BY name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateMember :one
-- Partial update (see UpdateClient).
UPDATE members
SET name          = COALESCE(sqlc.narg('name'), name),
    email         = COALESCE(sqlc.narg('email'), email),
    role          = COALESCE(sqlc.narg('role'), role),
    role_label    = COALESCE(sqlc.narg('role_label'), role_label),
    skill_tags    = COALESCE(sqlc.narg('skill_tags')::text[], skill_tags),
    allocation    = COALESCE(sqlc.narg('allocation'), allocation),
    capacity_days = COALESCE(sqlc.narg('capacity_days'), capacity_days),
    workload      = COALESCE(sqlc.narg('workload'), workload),
    status        = COALESCE(sqlc.narg('status'), status),
    updated_at    = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteMember :exec
DELETE FROM members
WHERE id = $1;

-- -------------------------------------------------------------- decisions ---

-- name: CreateDecision :one
INSERT INTO decisions (
    id,
    product_id,
    decided_on,
    title,
    detail,
    owner,
    status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: GetDecision :one
SELECT * FROM decisions
WHERE id = $1;

-- name: ListDecisionsByProduct :many
SELECT * FROM decisions
WHERE product_id = sqlc.arg('product_id')
ORDER BY decided_on DESC, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateDecision :one
-- Partial update (see UpdateClient).
UPDATE decisions
SET decided_on = COALESCE(sqlc.narg('decided_on'), decided_on),
    title      = COALESCE(sqlc.narg('title'), title),
    detail     = COALESCE(sqlc.narg('detail'), detail),
    owner      = COALESCE(sqlc.narg('owner'), owner),
    status     = COALESCE(sqlc.narg('status'), status),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDecision :exec
DELETE FROM decisions
WHERE id = $1;

-- ------------------------------------------------------- report_templates ---

-- name: ListReportTemplates :many
SELECT * FROM report_templates
ORDER BY name, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpsertReportTemplate :one
INSERT INTO report_templates (id, name, audience, visibility, sections)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET name       = EXCLUDED.name,
    audience   = EXCLUDED.audience,
    visibility = EXCLUDED.visibility,
    sections   = EXCLUDED.sections,
    updated_at = now()
RETURNING *;

-- name: DeleteReportTemplate :exec
DELETE FROM report_templates
WHERE id = $1;

-- ----------------------------------------------------------- report_queue ---

-- name: ListReportQueue :many
SELECT * FROM report_queue
ORDER BY due NULLS LAST, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: CreateReportQueueItem :one
INSERT INTO report_queue (
    id,
    title,
    product_id,
    client,
    type,
    template,
    due,
    status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: UpdateReportQueueStatus :one
UPDATE report_queue
SET status     = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteReportQueueItem :exec
DELETE FROM report_queue
WHERE id = $1;

-- ------------------------------------------------------ generated_reports ---

-- name: CreateGeneratedReport :one
-- A report may only cite a sprint of the product it reports on; without the
-- guard a report on one client's module could link to another client's sprint,
-- and following that link returned the other client's data.
INSERT INTO generated_reports (
    id,
    product_id,
    sprint_id,
    type,
    template,
    period,
    generated_on,
    status
)
SELECT
    sqlc.arg('id'),
    p.id,
    sqlc.narg('sprint_id'),
    sqlc.arg('type'),
    sqlc.arg('template'),
    sqlc.arg('period'),
    sqlc.arg('generated_on'),
    sqlc.arg('status')
FROM products p
WHERE p.id = sqlc.arg('product_id')
  AND (
      sqlc.narg('sprint_id')::text IS NULL
      OR EXISTS (SELECT 1 FROM sprints s
                  WHERE s.id = sqlc.narg('sprint_id') AND s.product_id = p.id)
  )
RETURNING *;

-- name: ListGeneratedReportsByProduct :many
SELECT * FROM generated_reports
WHERE product_id = sqlc.arg('product_id')
ORDER BY generated_on DESC, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: MarkGeneratedReportSent :one
UPDATE generated_reports
SET status     = 'sent',
    updated_at = now()
WHERE id = $1
RETURNING *;

-- ------------------------------------------------------------------ roles ---

-- name: ListRoles :many
SELECT * FROM roles
ORDER BY label, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpsertRole :one
INSERT INTO roles (id, label, permissions)
VALUES ($1, $2, $3)
ON CONFLICT (id) DO UPDATE
SET label       = EXCLUDED.label,
    permissions = EXCLUDED.permissions
RETURNING *;

-- ----------------------------------------------------------- master_lists ---

-- name: ListMasterValues :many
SELECT * FROM master_lists
WHERE key = sqlc.arg('key')
ORDER BY position, value
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: AddMasterValue :one
INSERT INTO master_lists (key, value, position)
VALUES ($1, $2, $3)
ON CONFLICT (key, value) DO UPDATE
SET position = EXCLUDED.position
RETURNING *;

-- name: DeleteMasterValue :exec
DELETE FROM master_lists
WHERE key = $1 AND value = $2;

-- ------------------------------------------------------ workspace_settings --

-- name: GetWorkspaceSettings :one
SELECT * FROM workspace_settings
WHERE id = TRUE;

-- name: UpsertWorkspaceSettings :one
INSERT INTO workspace_settings (id, name, settings, dod_template)
VALUES (TRUE, $1, $2, $3)
ON CONFLICT (id) DO UPDATE
SET name         = EXCLUDED.name,
    settings     = EXCLUDED.settings,
    dod_template = EXCLUDED.dod_template,
    updated_at   = now()
RETURNING *;
