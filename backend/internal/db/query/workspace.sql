-- One snapshot of the whole workspace, in the shape the frontend store keeps.
--
-- The store loads everything once and filters in memory, so these are not
-- paged: a workspace is tens of clients and hundreds of tasks, not the perf
-- seed's million rows. Nested rows (components, sprint members, DoD items)
-- ride along as JSON so the load is one round trip per table, not per row.

-- name: SnapshotClients :many
SELECT * FROM clients ORDER BY name, id;

-- name: SnapshotProjects :many
SELECT * FROM projects ORDER BY start_date, name, id;

-- name: SnapshotModules :many
SELECT m.*,
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'id', c.id, 'name', c.name, 'owner', c.owner, 'status', c.status)
                     ORDER BY c.position, c.id)
                 FROM components c WHERE c.module_id = m.id), '[]'::jsonb) AS components
FROM modules m
ORDER BY m.name, m.id;

-- name: SnapshotMembers :many
SELECT * FROM members ORDER BY name, id;

-- name: SnapshotBacklog :many
SELECT * FROM backlog_items ORDER BY created_at, id;

-- name: SnapshotSprints :many
SELECT s.*,
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'memberId', sm.member_id, 'allocation', sm.allocation,
                     'capacityDays', sm.capacity_days)
                     ORDER BY sm.member_id)
                 FROM sprint_members sm WHERE sm.sprint_id = s.id), '[]'::jsonb) AS members,
       COALESCE((SELECT jsonb_agg(sb.backlog_item_id ORDER BY sb.position, sb.backlog_item_id)
                 FROM sprint_backlog_items sb WHERE sb.sprint_id = s.id), '[]'::jsonb) AS backlog_item_ids
FROM sprints s
ORDER BY s.module_id, s.number, s.id;

-- name: SnapshotTasks :many
SELECT t.*,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('label', d.label, 'done', d.done)
                     ORDER BY d.position)
                 FROM task_dod d WHERE d.task_id = t.id), '[]'::jsonb) AS dod
FROM tasks t
ORDER BY t.created_at, t.id;

-- name: SnapshotDecisions :many
SELECT * FROM decisions ORDER BY decided_on DESC, id;

-- name: SnapshotReportQueue :many
SELECT * FROM report_queue ORDER BY due NULLS LAST, id;

-- name: SnapshotGeneratedReports :many
SELECT * FROM generated_reports ORDER BY generated_on DESC, id;

-- name: SnapshotReportTemplates :many
SELECT * FROM report_templates ORDER BY name, id;

-- name: SnapshotRoles :many
SELECT * FROM roles ORDER BY label, id;
