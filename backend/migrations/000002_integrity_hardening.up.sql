-- Integrity hardening — closes the holes an audit + stress test found in 000001.
--
-- Three themes:
--   1. a child must belong to the same parent as the parent it points at,
--   2. Postgres does not index the referencing side of a foreign key for you,
--   3. count/percentage columns deserve the same bounds products.health has.
--
-- PRE-FLIGHT: rows that already break these rules will stop this migration
-- (loudly, naming the row, leaving schema_migrations dirty — it will not quietly
-- accept broken data). On a database that has been written to, find them first:
--
--   SELECT * FROM products p JOIN projects pj ON pj.id = p.project_id
--    WHERE pj.client_id <> p.client_id;              -- fix: SET p.client_id = pj.client_id
--   SELECT * FROM sprints s JOIN modules m ON m.id = s.module_id
--    WHERE m.product_id <> s.product_id;             -- fix: SET s.module_id = NULL
--   SELECT * FROM backlog_items b JOIN modules m ON m.id = b.module_id
--    WHERE m.product_id <> b.product_id;             -- fix: SET b.module_id = NULL
--   SELECT * FROM sprints WHERE progress NOT BETWEEN 0 AND 100 OR number <= 0;
--   SELECT * FROM members WHERE allocation NOT BETWEEN 0 AND 100 OR workload < 0;
--
-- See backend/README.md for the full remediation script.

-- ---------------------------------------------------- foreign key indexes ---
-- Every DELETE on the referenced table scans these columns to enforce the
-- constraint. Without an index that scan is sequential and grows forever.
CREATE INDEX sprint_members_member_id_idx          ON sprint_members (member_id);
CREATE INDEX sprint_backlog_items_backlog_item_idx ON sprint_backlog_items (backlog_item_id);
CREATE INDEX products_current_sprint_id_idx        ON products (current_sprint_id);
CREATE INDEX generated_reports_sprint_id_idx       ON generated_reports (sprint_id);

-- UNIQUE (product_id, number) already provides a product_id-leading btree.
DROP INDEX sprints_product_id_idx;

-- ------------------------------------------------------- product lineage ---
-- products.client_id is denormalised. Nothing stopped it from disagreeing with
-- the project's client, and because it carried its own ON DELETE CASCADE to
-- clients, pointing it at an unrelated client let a DELETE on that client
-- destroy the product and its whole subtree. Tie the pair to the project
-- instead: the client can now only be the project's client, and the row still
-- disappears with its client — via the project, the way it should.
ALTER TABLE projects
    ADD CONSTRAINT projects_id_client_id_key UNIQUE (id, client_id);

-- The single-column project FK goes with it: the composite one covers the same
-- reference, and keeping both would run the products cascade twice per delete
-- under two different ON UPDATE rules.
ALTER TABLE products
    DROP CONSTRAINT products_client_id_fkey,
    DROP CONSTRAINT products_project_id_fkey,
    ADD CONSTRAINT products_project_client_fkey
        FOREIGN KEY (project_id, client_id) REFERENCES projects (id, client_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

-- ----------------------------------------------------- component lineage ---
-- A sprint or a backlog item may only hang off a Component of its own Module.
-- The column-list form of SET NULL (PostgreSQL 15+) clears just module_id and
-- leaves the NOT NULL product_id alone.
ALTER TABLE modules
    ADD CONSTRAINT modules_id_product_id_key UNIQUE (id, product_id);

ALTER TABLE sprints
    DROP CONSTRAINT sprints_module_id_fkey,
    ADD CONSTRAINT sprints_module_fkey
        FOREIGN KEY (module_id, product_id) REFERENCES modules (id, product_id)
        ON DELETE SET NULL (module_id);

ALTER TABLE backlog_items
    DROP CONSTRAINT backlog_items_module_id_fkey,
    ADD CONSTRAINT backlog_items_module_fkey
        FOREIGN KEY (module_id, product_id) REFERENCES modules (id, product_id)
        ON DELETE SET NULL (module_id);

-- ---------------------------------------------------------------- bounds ---
-- products.health had CHECK (0..100); its siblings did not, so progress:5000
-- and allocation:-50 were accepted.
ALTER TABLE sprints
    ADD CONSTRAINT sprints_progress_check CHECK (progress BETWEEN 0 AND 100),
    -- The upper bound matters as much as the lower one: NextSprintNumber is
    -- MAX(number) + 1 on an INTEGER, so a single sprint numbered 2147483647
    -- would overflow that expression and break auto-numbering for the product
    -- permanently.
    ADD CONSTRAINT sprints_number_check   CHECK (number BETWEEN 1 AND 100000),
    ADD CONSTRAINT sprints_counts_check
        CHECK (working_days >= 0 AND days_left >= 0 AND committed >= 0 AND completed >= 0),
    ADD CONSTRAINT sprints_dates_check
        CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);

ALTER TABLE products
    ADD CONSTRAINT products_velocity_check      CHECK (velocity >= 0),
    ADD CONSTRAINT products_blocked_count_check CHECK (blocked_count >= 0);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_blocked_days_check CHECK (blocked_days IS NULL OR blocked_days >= 0);

ALTER TABLE members
    ADD CONSTRAINT members_allocation_check    CHECK (allocation BETWEEN 0 AND 100),
    ADD CONSTRAINT members_workload_check      CHECK (workload >= 0),
    -- NUMERIC(5,2) already rejects anything past 999.99 with a 500-flavoured
    -- overflow; this only pins the lower bound, which the type does not.
    ADD CONSTRAINT members_capacity_days_check CHECK (capacity_days >= 0);

ALTER TABLE sprint_members
    ADD CONSTRAINT sprint_members_allocation_check    CHECK (allocation BETWEEN 0 AND 100),
    ADD CONSTRAINT sprint_members_capacity_days_check CHECK (capacity_days >= 0);

-- ------------------------------------------------------------ jsonb size ---
-- A body limit counts bytes on the wire, which is not what a jsonb column
-- costs: `1e131071` is nine characters that decode to a megabyte, and every
-- later read pays for it. Bound the decoded document instead.
ALTER TABLE clients
    ADD CONSTRAINT clients_ai_insight_size_check
        CHECK (ai_insight IS NULL OR length(ai_insight::text) <= 65536);
ALTER TABLE products
    ADD CONSTRAINT products_ai_insight_size_check
        CHECK (ai_insight IS NULL OR length(ai_insight::text) <= 65536);
ALTER TABLE roles
    ADD CONSTRAINT roles_permissions_check
        CHECK (jsonb_typeof(permissions) = 'object' AND length(permissions::text) <= 65536);
ALTER TABLE workspace_settings
    ADD CONSTRAINT workspace_settings_settings_check
        CHECK (jsonb_typeof(settings) = 'object' AND length(settings::text) <= 65536);

ALTER TABLE backlog_items
    ADD CONSTRAINT backlog_items_estimate_check CHECK (estimate >= 0);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_estimate_check CHECK (estimate >= 0);

ALTER TABLE task_dod
    ADD CONSTRAINT task_dod_position_check CHECK (position >= 0);

ALTER TABLE sprint_backlog_items
    ADD CONSTRAINT sprint_backlog_items_position_check CHECK (position >= 0);

ALTER TABLE modules
    ADD CONSTRAINT modules_position_check CHECK (position >= 0);

-- ------------------------------------------------------ settings singleton ---
-- workspace_settings is a one-row table the API reads with :one. The row was
-- never created, so GET /settings answered 404 on a fresh database.
INSERT INTO workspace_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
