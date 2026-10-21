-- Retro and review records. Each list takes an optional sprint filter: the
-- store loads a whole workspace on entry, the retro page loads one sprint.

-- ------------------------------------------------------------ retro_notes ---

-- name: CreateRetroNote :one
INSERT INTO retro_notes (id, sprint_id, kind, text)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListRetroNotes :many
SELECT * FROM retro_notes
WHERE sqlc.narg('sprint_id')::text IS NULL OR sprint_id = sqlc.narg('sprint_id')
ORDER BY created_at, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateRetroNote :one
UPDATE retro_notes
SET kind       = COALESCE(sqlc.narg('kind'), kind),
    text       = COALESCE(sqlc.narg('text'), text),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteRetroNote :execrows
DELETE FROM retro_notes
WHERE id = $1;

-- ---------------------------------------------------------- retro_actions ---

-- name: CreateRetroAction :one
INSERT INTO retro_actions (id, sprint_id, action, owner_id, due, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListRetroActions :many
SELECT * FROM retro_actions
WHERE sqlc.narg('sprint_id')::text IS NULL OR sprint_id = sqlc.narg('sprint_id')
ORDER BY created_at, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateRetroAction :one
UPDATE retro_actions
SET action     = COALESCE(sqlc.narg('action'), action),
    owner_id   = COALESCE(sqlc.narg('owner_id'), owner_id),
    due        = COALESCE(sqlc.narg('due'), due),
    status     = COALESCE(sqlc.narg('status'), status),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteRetroAction :execrows
DELETE FROM retro_actions
WHERE id = $1;

-- ------------------------------------------------------------- demo_items ---

-- name: CreateDemoItem :one
INSERT INTO demo_items (id, sprint_id, label, done)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListDemoItems :many
SELECT * FROM demo_items
WHERE sqlc.narg('sprint_id')::text IS NULL OR sprint_id = sqlc.narg('sprint_id')
ORDER BY created_at, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateDemoItem :one
UPDATE demo_items
SET label      = COALESCE(sqlc.narg('label'), label),
    done       = COALESCE(sqlc.narg('done'), done),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDemoItem :execrows
DELETE FROM demo_items
WHERE id = $1;

-- -------------------------------------------------------- client_feedback ---

-- name: CreateClientFeedback :one
INSERT INTO client_feedback (id, sprint_id, from_name, note, disposition)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListClientFeedback :many
SELECT * FROM client_feedback
WHERE sqlc.narg('sprint_id')::text IS NULL OR sprint_id = sqlc.narg('sprint_id')
ORDER BY created_at, id
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: UpdateClientFeedback :one
UPDATE client_feedback
SET from_name   = COALESCE(sqlc.narg('from_name'), from_name),
    note        = COALESCE(sqlc.narg('note'), note),
    disposition = COALESCE(sqlc.narg('disposition'), disposition),
    updated_at  = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteClientFeedback :execrows
DELETE FROM client_feedback
WHERE id = $1;
