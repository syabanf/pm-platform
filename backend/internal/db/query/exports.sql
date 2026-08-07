-- Unbounded, ordered reads for CSV export. Deliberately not paginated: an export
-- is the whole set, streamed row by row so a large one does not build in memory.

-- name: ExportClients :many
SELECT id, name, industry, status, health, risk, contract_type,
       (archived_at IS NOT NULL)::bool AS archived
FROM clients
ORDER BY name, id;

-- name: ExportModuleTasks :many
-- Every task in a module, across its sprints, with the sprint number and the
-- assignee's name resolved — the task list a delivery lead exports for a report.
SELECT t.id, s.number AS sprint_number, t.title, t.component_name,
       t.board_column, t.priority, t.estimate,
       COALESCE(m.name, '') AS assignee
FROM tasks t
JOIN sprints s ON s.id = t.sprint_id
LEFT JOIN members m ON m.id = t.assignee_id
WHERE s.module_id = sqlc.arg('module_id')
ORDER BY s.number, t.created_at, t.id;
