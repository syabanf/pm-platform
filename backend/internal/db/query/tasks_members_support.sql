-- ------------------------------------------------------------------ tasks ---

-- name: CreateTask :one
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
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
RETURNING *;

-- name: GetTask :one
SELECT * FROM tasks
WHERE id = $1;

-- name: ListTasksBySprint :many
SELECT * FROM tasks
WHERE sprint_id = $1
ORDER BY created_at, id;

-- name: ListTasksByBacklogItem :many
SELECT * FROM tasks
WHERE backlog_item_id = $1
ORDER BY created_at, id;

-- name: UpdateTask :one
UPDATE tasks
SET title           = $2,
    module_name     = $3,
    assignee_id     = $4,
    estimate        = $5,
    board_column    = $6,
    priority        = $7,
    blocked_reason  = $8,
    blocked_days    = $9,
    off_goal        = $10,
    updated_at      = now()
WHERE id = $1
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
WHERE task_id = $1
ORDER BY position;

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
ORDER BY name, id;

-- name: UpdateMember :one
UPDATE members
SET name          = $2,
    email         = $3,
    role          = $4,
    role_label    = $5,
    skill_tags    = $6,
    allocation    = $7,
    capacity_days = $8,
    workload      = $9,
    status        = $10,
    updated_at    = now()
WHERE id = $1
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
WHERE product_id = $1
ORDER BY decided_on DESC, id;

-- name: UpdateDecision :one
UPDATE decisions
SET decided_on = $2,
    title      = $3,
    detail     = $4,
    owner      = $5,
    status     = $6,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteDecision :exec
DELETE FROM decisions
WHERE id = $1;

-- ------------------------------------------------------- report_templates ---

-- name: ListReportTemplates :many
SELECT * FROM report_templates
ORDER BY name;

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
ORDER BY due NULLS LAST, id;

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
INSERT INTO generated_reports (
    id,
    product_id,
    sprint_id,
    type,
    template,
    period,
    generated_on,
    status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: ListGeneratedReportsByProduct :many
SELECT * FROM generated_reports
WHERE product_id = $1
ORDER BY generated_on DESC, id;

-- name: MarkGeneratedReportSent :one
UPDATE generated_reports
SET status     = 'sent',
    updated_at = now()
WHERE id = $1
RETURNING *;

-- ------------------------------------------------------------------ roles ---

-- name: ListRoles :many
SELECT * FROM roles
ORDER BY label, id;

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
WHERE key = $1
ORDER BY position, value;

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
