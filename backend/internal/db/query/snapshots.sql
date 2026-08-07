-- name: CaptureActiveSprintSnapshots :execrows
-- Records today's remaining and completed points for every active sprint, in
-- one statement. Idempotent per day: run it hourly and the latest wins. A daily
-- cron would hit POST /snapshots/capture; this is what it runs.
INSERT INTO sprint_daily_snapshots (sprint_id, snapshot_on, remaining_points, completed_points)
SELECT id, CURRENT_DATE, GREATEST(committed - completed, 0), completed
FROM sprints
WHERE status = 'active'
ON CONFLICT (sprint_id, snapshot_on) DO UPDATE
SET remaining_points = EXCLUDED.remaining_points,
    completed_points = EXCLUDED.completed_points;

-- name: ListSprintBurndown :many
-- The recorded burn for one sprint, oldest first — the real series a chart draws
-- instead of a synthesized straight line.
SELECT snapshot_on, remaining_points, completed_points
FROM sprint_daily_snapshots
WHERE sprint_id = $1
ORDER BY snapshot_on;

-- name: ModuleVelocity :many
-- Completed points per finished sprint, in sprint order — velocity's trend,
-- computed straight from the sprints table (no snapshot needed).
SELECT number, name, committed, completed
FROM sprints
WHERE module_id = $1 AND status IN ('review', 'done')
ORDER BY number;
