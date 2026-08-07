-- Aggregate reads. The frontend recomputes these by pulling whole collections
-- and counting in the browser — the dashboard alone fires a GET per sprint. One
-- query each, computed where the data lives.

-- name: PortfolioRollup :one
-- The home dashboard in a single request: the counters it used to sum by hand.
SELECT
    (SELECT count(*) FROM clients WHERE archived_at IS NULL)   AS active_clients,
    (SELECT count(*) FROM projects)                            AS projects,
    (SELECT count(*) FROM modules)                             AS modules,
    (SELECT count(*) FROM modules WHERE risk <> 'low')         AS at_risk_modules,
    (SELECT count(*) FROM sprints WHERE status = 'active')     AS active_sprints,
    (SELECT count(*) FROM tasks   WHERE board_column = 'blocked') AS blocked_tasks,
    (SELECT count(*) FROM report_queue WHERE status <> 'done') AS reports_due;

-- name: ModuleRollup :one
-- One module's numbers without walking its sprints: what the module overview and
-- the project drill-down recompute per row. Every column is table-qualified so
-- the shared module_id is never ambiguous.
SELECT
    (SELECT count(*) FROM components    c  WHERE c.module_id  = sqlc.arg('module_id')) AS components,
    (SELECT count(*) FROM sprints       sp WHERE sp.module_id = sqlc.arg('module_id')) AS sprints,
    (SELECT count(*) FROM backlog_items b  WHERE b.module_id  = sqlc.arg('module_id')) AS backlog_items,
    (SELECT count(*) FROM sprints sp WHERE sp.module_id = sqlc.arg('module_id') AND sp.status = 'active') AS active_sprints,
    (SELECT coalesce(sum(sp.committed), 0) FROM sprints sp WHERE sp.module_id = sqlc.arg('module_id')) AS committed_points,
    (SELECT coalesce(sum(sp.completed), 0) FROM sprints sp WHERE sp.module_id = sqlc.arg('module_id')) AS completed_points,
    (SELECT count(*)
       FROM tasks t
       JOIN sprints s ON s.id = t.sprint_id
      WHERE s.module_id = sqlc.arg('module_id') AND t.board_column = 'blocked') AS blocked_tasks;
