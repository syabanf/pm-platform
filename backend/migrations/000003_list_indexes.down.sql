-- Inverse of 000003_list_indexes.up.sql.

DROP INDEX sprint_backlog_items_sprint_position_idx;

DROP INDEX products_created_idx;
DROP INDEX members_name_idx;
DROP INDEX projects_name_idx;
DROP INDEX clients_name_idx;

DROP INDEX report_queue_due_idx;

CREATE INDEX generated_reports_product_id_idx ON generated_reports (product_id);
DROP INDEX generated_reports_product_generated_idx;

CREATE INDEX decisions_product_id_idx ON decisions (product_id);
DROP INDEX decisions_product_decided_idx;

CREATE INDEX backlog_items_product_id_idx ON backlog_items (product_id);
DROP INDEX backlog_items_product_created_idx;

CREATE INDEX tasks_sprint_id_idx ON tasks (sprint_id);
DROP INDEX tasks_sprint_created_idx;
