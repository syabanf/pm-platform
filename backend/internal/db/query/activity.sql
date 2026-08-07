-- name: InsertActivity :exec
INSERT INTO activity_log (actor_id, actor_email, action, target_kind, target_id, method, path)
VALUES (
    sqlc.arg('actor_id'), sqlc.arg('actor_email'), sqlc.arg('action'),
    sqlc.arg('target_kind'), sqlc.arg('target_id'), sqlc.arg('method'), sqlc.arg('path')
);

-- name: ListActivity :many
SELECT id, occurred_at, actor_id, actor_email, action, target_kind, target_id, method, path
FROM activity_log
ORDER BY occurred_at DESC, id DESC
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');

-- name: ListActivityForTarget :many
SELECT id, occurred_at, actor_id, actor_email, action, target_kind, target_id, method, path
FROM activity_log
WHERE target_kind = sqlc.arg('target_kind') AND target_id = sqlc.arg('target_id')
ORDER BY occurred_at DESC, id DESC
LIMIT sqlc.arg('lim') OFFSET sqlc.arg('off');
