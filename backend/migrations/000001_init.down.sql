-- Reverse of 000001_init.up.sql. Dropped child-first so FKs never block.

ALTER TABLE IF EXISTS products DROP CONSTRAINT IF EXISTS products_current_sprint_id_fkey;

DROP TABLE IF EXISTS workspace_settings;
DROP TABLE IF EXISTS master_lists;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS generated_reports;
DROP TABLE IF EXISTS report_queue;
DROP TABLE IF EXISTS report_templates;
DROP TABLE IF EXISTS decisions;
DROP TABLE IF EXISTS task_dod;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS sprint_backlog_items;
DROP TABLE IF EXISTS sprint_members;
DROP TABLE IF EXISTS sprints;
DROP TABLE IF EXISTS backlog_items;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS clients;
