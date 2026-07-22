-- Inverse of 000002_integrity_hardening.up.sql.

-- Only remove the singleton if it is still the untouched one this migration
-- created. Deleting it unconditionally would throw away a real workspace's
-- name, settings and DoD template, and re-applying up would hide the loss
-- behind a fresh row of defaults.
DELETE FROM workspace_settings
WHERE id = TRUE
  AND name = 'WIT Sprint OS'
  AND settings = '{}'::jsonb
  AND dod_template = '{}';

ALTER TABLE workspace_settings DROP CONSTRAINT workspace_settings_settings_check;
ALTER TABLE roles              DROP CONSTRAINT roles_permissions_check;
ALTER TABLE products           DROP CONSTRAINT products_ai_insight_size_check;
ALTER TABLE clients            DROP CONSTRAINT clients_ai_insight_size_check;

ALTER TABLE tasks    DROP CONSTRAINT tasks_blocked_days_check;
ALTER TABLE products
    DROP CONSTRAINT products_blocked_count_check,
    DROP CONSTRAINT products_velocity_check;

ALTER TABLE modules              DROP CONSTRAINT modules_position_check;
ALTER TABLE sprint_backlog_items DROP CONSTRAINT sprint_backlog_items_position_check;
ALTER TABLE task_dod             DROP CONSTRAINT task_dod_position_check;
ALTER TABLE tasks                DROP CONSTRAINT tasks_estimate_check;
ALTER TABLE backlog_items        DROP CONSTRAINT backlog_items_estimate_check;

ALTER TABLE sprint_members
    DROP CONSTRAINT sprint_members_capacity_days_check,
    DROP CONSTRAINT sprint_members_allocation_check;

ALTER TABLE members
    DROP CONSTRAINT members_capacity_days_check,
    DROP CONSTRAINT members_workload_check,
    DROP CONSTRAINT members_allocation_check;

ALTER TABLE sprints
    DROP CONSTRAINT sprints_dates_check,
    DROP CONSTRAINT sprints_counts_check,
    DROP CONSTRAINT sprints_number_check,
    DROP CONSTRAINT sprints_progress_check;

ALTER TABLE backlog_items
    DROP CONSTRAINT backlog_items_module_fkey,
    ADD CONSTRAINT backlog_items_module_id_fkey
        FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE SET NULL;

ALTER TABLE sprints
    DROP CONSTRAINT sprints_module_fkey,
    ADD CONSTRAINT sprints_module_id_fkey
        FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE SET NULL;

ALTER TABLE modules DROP CONSTRAINT modules_id_product_id_key;

ALTER TABLE products
    DROP CONSTRAINT products_project_client_fkey,
    ADD CONSTRAINT products_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    ADD CONSTRAINT products_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE;

ALTER TABLE projects DROP CONSTRAINT projects_id_client_id_key;

CREATE INDEX sprints_product_id_idx ON sprints (product_id);

DROP INDEX generated_reports_sprint_id_idx;
DROP INDEX products_current_sprint_id_idx;
DROP INDEX sprint_backlog_items_backlog_item_idx;
DROP INDEX sprint_members_member_id_idx;
