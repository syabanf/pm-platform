-- Indexes for the way lists are actually read.
--
-- A load test against 1.16M rows found every list doing the same thing: read
-- the whole matching set, sort it, throw away all but one page. That is cheap
-- while a parent has twenty children and quadratic-ish when one has thousands —
-- GET /sprints/{id}/tasks on a sprint holding 200k tasks stopped using
-- tasks_sprint_id_idx entirely and read the whole 700k-row heap (34 ms, 25,629
-- buffers) because the index could order by sprint_id but not by created_at.
--
-- Each index below leads with the column the query filters on and continues
-- with the columns it orders by, so the index can serve the ORDER BY and the
-- LIMIT can stop early. Measured with the index present, in a rolled-back
-- transaction, before being written down here.

-- Parent-scoped lists. The leading column matches the old single-column index,
-- so those are dropped rather than kept alongside.
CREATE INDEX tasks_sprint_created_idx
    ON tasks (sprint_id, created_at, id);                    -- 34.191 ms -> 0.730 ms
DROP INDEX tasks_sprint_id_idx;

CREATE INDEX backlog_items_product_created_idx
    ON backlog_items (product_id, created_at DESC, id);      -- 75.927 ms -> index scan
DROP INDEX backlog_items_product_id_idx;

CREATE INDEX decisions_product_decided_idx
    ON decisions (product_id, decided_on DESC, id);          -- 15.668 ms for 201 rows
DROP INDEX decisions_product_id_idx;

CREATE INDEX generated_reports_product_generated_idx
    ON generated_reports (product_id, generated_on DESC, id);
DROP INDEX generated_reports_product_id_idx;

-- report_queue_product_id_idx stays: it serves the cascade from products, which
-- the (due, id) index below cannot.
CREATE INDEX report_queue_due_idx
    ON report_queue (due NULLS LAST, id);                    -- 4.678 ms -> 0.063 ms

-- Unfiltered top-level lists. Small today, but the cost is a function of the
-- table rather than of the page, so it grows with the data and never with the
-- request.
CREATE INDEX clients_name_idx   ON clients (name, id);
CREATE INDEX projects_name_idx  ON projects (name, id);      -- 1.360 ms -> 0.050 ms
CREATE INDEX members_name_idx   ON members (name, id);       -- 1.285 ms -> 0.108 ms
CREATE INDEX products_created_idx
    ON products (created_at, name, id);                      -- 3.301 ms -> 0.096 ms

-- NextSprintBacklogPosition runs inside the sprint's row lock, so its cost is
-- held contention, not just latency: 0.706 ms -> 0.057 ms, and an Index Only
-- Scan Backward instead of a bitmap heap scan plus aggregate.
CREATE INDEX sprint_backlog_items_sprint_position_idx
    ON sprint_backlog_items (sprint_id, position);
