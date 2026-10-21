-- name: InsertTrash :exec
INSERT INTO trash (id, kind, root_id, label, payload, deleted_by)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: GetTrash :one
SELECT * FROM trash
WHERE id = $1;

-- name: DeleteTrash :exec
DELETE FROM trash
WHERE id = $1;

-- name: SweepTrash :exec
DELETE FROM trash
WHERE deleted_at < now() - interval '30 days';

-- name: ProjectIDsByClient :many
SELECT id FROM projects
WHERE client_id = $1;

-- name: ModuleIDsByProjects :many
SELECT id FROM modules
WHERE project_id = ANY(sqlc.arg('project_ids')::text[]);

-- name: SprintIDsByModules :many
SELECT id FROM sprints
WHERE module_id = ANY(sqlc.arg('module_ids')::text[]);

-- name: TaskIDsBySprints :many
SELECT id FROM tasks
WHERE sprint_id = ANY(sqlc.arg('sprint_ids')::text[]);
