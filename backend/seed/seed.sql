-- Seed a database with a realistic delivery portfolio.
--
-- Every id encodes its lineage (cli-000001-prj-2-mod-1-spr-7), so the composite
-- foreign keys 000002 added hold by construction rather than by luck, and a row
-- that turns up in a slow query log tells you where it lives.
--
--   make seed                     # the default ~1.1M rows
--   make seed SCALE_CLIENTS=1000  # bigger
--
-- Re-running is safe: it truncates first.

\set ON_ERROR_STOP on

\if :{?clients}          \else \set clients 200            \endif
\if :{?projects_per}     \else \set projects_per 4         \endif
\if :{?products_per}     \else \set products_per 3         \endif
\if :{?components_per}   \else \set components_per 4       \endif
\if :{?sprints_per}      \else \set sprints_per 10         \endif
\if :{?backlog_per}      \else \set backlog_per 30         \endif
\if :{?tasks_per}        \else \set tasks_per 20           \endif
\if :{?members}          \else \set members 2000           \endif

TRUNCATE clients, members, roles, master_lists, report_templates RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------- clients ---
INSERT INTO clients (id, name, industry, status, client_pic, wit_owner,
                     contract_type, health, risk, notes, action_needed)
SELECT
    'cli-' || lpad(i::text, 6, '0'),
    (ARRAY['UBS Gold','BSM','BNI','Astra Otoparts','Pupuk Kaltim','Semen Indonesia',
           'Telkomsel','Pertamina Hulu','Krakatau Steel','Bank Mandiri'])[1 + i % 10]
        || CASE WHEN i > 10 THEN ' ' || ((i - 1) / 10 + 1)::text ELSE '' END,
    (ARRAY['Manufacturing','Heavy Equipment Rental','Banking','Automotive',
           'Chemicals','Telecommunications','Energy','Steel'])[1 + i % 8],
    (ARRAY['active','active','active','inactive','prospect'])[1 + i % 5],
    (ARRAY['Andi Wijaya','Siti Rahma','Budi Santoso','Dewi Lestari'])[1 + i % 4],
    (ARRAY['Fahmi','Rina','Yoga','Putri'])[1 + i % 4],
    (ARRAY['Retainer','Fixed scope','Project-based','Time & materials'])[1 + i % 4],
    (ARRAY['healthy','healthy','warning','at-risk'])[1 + i % 4],
    (ARRAY['low','low','medium','high'])[1 + i % 4],
    'Seeded portfolio account.',
    CASE WHEN i % 7 = 0 THEN ARRAY['Schedule QBR','Chase invoice'] ELSE '{}'::text[] END
FROM generate_series(1, :clients) i;

-- --------------------------------------------------------------- projects ---
INSERT INTO projects (id, client_id, name, objective, status)
SELECT
    c.id || '-prj-' || p,
    c.id,
    (ARRAY['Manufacturing Digital Transformation','Fleet Telemetry Programme',
           'Core Banking Modernisation','Plant Reliability Uplift'])[1 + p % 4],
    'Deliver measurable operational uplift within the fiscal year.',
    (ARRAY['discovery','active','active','done','on-hold'])[1 + (p + length(c.id)) % 5]
FROM clients c, generate_series(1, :projects_per) p;

-- ------------------------------------------------- products (UI "Module") ---
INSERT INTO products (id, project_id, client_id, name, goal, owner, delivery_lead,
                      status, health, risk, velocity, blocked_count)
SELECT
    pj.id || '-mod-' || m,
    pj.id,
    pj.client_id,                                  -- always the project's client
    (ARRAY['OEE Intelligence Platform','Rental Utilisation Suite',
           'Digital Onboarding','Predictive Maintenance'])[1 + m % 4],
    'Ship the smallest thing that proves the value.',
    (ARRAY['Fahmi','Rina','Yoga'])[1 + m % 3],
    (ARRAY['Andi','Siti','Budi'])[1 + m % 3],
    (ARRAY['discovery','development','development','release','maintenance'])[1 + m % 5],
    55 + (m * 7) % 46,                              -- 55..100, inside CHECK
    (ARRAY['low','medium','high'])[1 + m % 3],
    18 + (m * 3) % 25,
    m % 4
FROM projects pj, generate_series(1, :products_per) m;

-- ----------------------------------------------- modules (UI "Component") ---
INSERT INTO modules (id, product_id, name, owner, status, position)
SELECT
    pr.id || '-cmp-' || k,
    pr.id,
    (ARRAY['Machine Data Acquisition','Downtime Analytics','Operator Console',
           'Reporting & Export'])[1 + k % 4],
    (ARRAY['Yoga','Putri','Rina','Budi'])[1 + k % 4],
    (ARRAY['planned','in-progress','in-progress','done'])[1 + k % 4],
    k - 1                                           -- gapless 0..n-1
FROM products pr, generate_series(1, :components_per) k;

-- ---------------------------------------------------------------- members ---
INSERT INTO members (id, name, email, role, role_label, skill_tags,
                     allocation, capacity_days, workload, status)
SELECT
    'mbr-' || lpad(i::text, 6, '0'),
    (ARRAY['Andi','Siti','Budi','Dewi','Fahmi','Rina','Yoga','Putri'])[1 + i % 8]
        || ' ' ||
    (ARRAY['Wijaya','Rahma','Santoso','Lestari','Pratama','Hakim'])[1 + i % 6],
    'member' || i || '@wit.example',
    (ARRAY['pm','be','fe','qa','ux'])[1 + i % 5],
    (ARRAY['Project Manager','Backend Engineer','Frontend Engineer',
           'QA Engineer','UX Designer'])[1 + i % 5],
    (ARRAY['Go','React','Postgres'])[1 + i % 3 : 1 + i % 3],
    (ARRAY[100, 80, 50, 60])[1 + i % 4],            -- inside CHECK 0..100
    (ARRAY[10.0, 8.0, 5.0, 6.5])[1 + i % 4],
    i % 90,
    (ARRAY['active','active','active','inactive','temporary'])[1 + i % 5]
FROM generate_series(1, :members) i;

-- ---------------------------------------------------------- backlog_items ---
-- module_id names a Component of this very product, which is what the composite
-- foreign key requires.
INSERT INTO backlog_items (id, product_id, module_id, title, story,
                           acceptance_criteria, type, priority, readiness, estimate)
SELECT
    pr.id || '-bli-' || b,
    pr.id,
    pr.id || '-cmp-' || (1 + b % :components_per),
    (ARRAY['Ingest PLC tag stream','Downtime reason codes','Shift handover view',
           'Export weekly OEE','Alert on threshold breach'])[1 + b % 5]
        || ' #' || b,
    'As an operator I want to see what stopped the line so I can act on it.',
    ARRAY['Given a stopped line','When a reason is picked','Then OEE recalculates'],
    (ARRAY['story','story','bug','spike','chore'])[1 + b % 5],
    (ARRAY['low','medium','high','critical'])[1 + b % 4],
    (ARRAY['ready','needs-clarification','draft'])[1 + b % 3],
    (ARRAY[1, 2, 3, 5, 8, 13])[1 + b % 6]
FROM products pr, generate_series(1, :backlog_per) b;

-- ---------------------------------------------------------------- sprints ---
INSERT INTO sprints (id, product_id, module_id, number, name, goal,
                     start_date, end_date, working_days, days_left,
                     status, committed, completed, progress, risk)
SELECT
    pr.id || '-spr-' || n,
    pr.id,
    pr.id || '-cmp-' || (1 + n % :components_per),
    n,                                              -- unique per product
    'Sprint ' || lpad(n::text, 2, '0'),
    'Close the loop on the top downtime reason.',
    DATE '2026-01-05' + ((n - 1) * 14),
    DATE '2026-01-05' + ((n - 1) * 14) + 13,        -- always >= start_date
    10,
    CASE WHEN n = :sprints_per THEN 6 ELSE 0 END,
    CASE WHEN n = :sprints_per THEN 'active'
         WHEN n = :sprints_per - 1 THEN 'review'
         ELSE 'done' END,
    24 + n % 12,
    CASE WHEN n < :sprints_per THEN 24 + n % 12 ELSE (24 + n % 12) / 2 END,
    CASE WHEN n < :sprints_per THEN 100 ELSE 45 END,
    (ARRAY['low','low','medium','high'])[1 + n % 4]
FROM products pr, generate_series(1, :sprints_per) n;

-- the newest sprint of each product is the current one
UPDATE products pr
SET current_sprint_id = pr.id || '-spr-' || :sprints_per;

-- --------------------------------------------------- sprint_backlog_items ---
INSERT INTO sprint_backlog_items (sprint_id, backlog_item_id, position)
SELECT
    s.id,
    s.product_id || '-bli-' || (1 + ((s.number - 1) * 8 + q) % :backlog_per),
    q
FROM sprints s, generate_series(0, 7) q
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------- sprint_members ---
INSERT INTO sprint_members (sprint_id, member_id, allocation, capacity_days)
SELECT
    s.id,
    'mbr-' || lpad((1 + (abs(hashtext(s.id)) + q) % :members)::text, 6, '0'),
    (ARRAY[100, 80, 50, 60])[1 + q % 4],
    (ARRAY[10.0, 8.0, 5.0, 6.5])[1 + q % 4]
FROM sprints s, generate_series(0, 3) q
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ tasks ---
INSERT INTO tasks (id, sprint_id, backlog_item_id, title, module_name,
                   assignee_id, estimate, board_column, priority,
                   blocked_reason, blocked_days, off_goal)
SELECT
    s.id || '-tsk-' || t,
    s.id,
    s.product_id || '-bli-' || (1 + ((s.number - 1) * 8 + t % 8) % :backlog_per),
    (ARRAY['Wire the tag reader','Add reason-code table','Chart the shift view',
           'Write the export job','Handle the alert path'])[1 + t % 5] || ' #' || t,
    (ARRAY['Machine Data Acquisition','Downtime Analytics','Operator Console',
           'Reporting & Export'])[1 + t % 4],
    CASE WHEN t % 6 = 0 THEN NULL
         ELSE 'mbr-' || lpad((1 + (abs(hashtext(s.id)) + t) % :members)::text, 6, '0') END,
    (ARRAY[1, 2, 3, 5])[1 + t % 4],
    CASE WHEN s.status = 'done' THEN 'done'
         ELSE (ARRAY['selected','ready','in-progress','in-review','qa','done','blocked'])[1 + t % 7]
    END,
    (ARRAY['low','medium','high'])[1 + t % 3],
    CASE WHEN t % 13 = 0 THEN 'Waiting on vendor firmware' ELSE NULL END,
    CASE WHEN t % 13 = 0 THEN t % 5 ELSE NULL END,
    t % 11 = 0
FROM sprints s, generate_series(1, :tasks_per) t;

-- --------------------------------------------------------------- task_dod ---
-- Only the in-flight sprints carry a checklist; seeding one per task everywhere
-- would double the row count for no extra signal.
INSERT INTO task_dod (task_id, position, label, done)
SELECT
    tk.id,
    d,
    (ARRAY['Code reviewed','Tests written','Deployed to staging'])[d + 1],
    d < 2 AND tk.board_column = 'done'
FROM tasks tk, generate_series(0, 2) d
WHERE tk.board_column IN ('in-review', 'qa', 'done')
  AND abs(hashtext(tk.id)) % 5 = 0;

-- -------------------------------------------------------------- decisions ---
INSERT INTO decisions (id, product_id, decided_on, title, detail, owner, status)
SELECT
    pr.id || '-dec-' || d,
    pr.id,
    DATE '2026-02-01' + d * 9,
    (ARRAY['Buy vs build the historian','Drop the legacy CSV import',
           'Move QA to shift-left','Defer multi-plant rollout'])[1 + d % 4],
    'Recorded during sprint review; revisit at the next QBR.',
    (ARRAY['Fahmi','Rina','Yoga'])[1 + d % 3],
    (ARRAY['open','decided','decided'])[1 + d % 3]
FROM products pr, generate_series(1, 5) d;

-- ------------------------------------------------------ generated_reports ---
INSERT INTO generated_reports (id, product_id, sprint_id, type, template,
                               period, generated_on, status)
SELECT
    pr.id || '-rep-' || r,
    pr.id,
    pr.id || '-spr-' || (1 + r % :sprints_per),     -- a sprint of this product
    (ARRAY['Sprint Report','Module Report','Client Report'])[1 + r % 3],
    'Standard',
    '2026-Q' || (1 + r % 4),
    DATE '2026-03-01' + r * 11,
    (ARRAY['draft','sent','sent'])[1 + r % 3]
FROM products pr, generate_series(1, 4) r;

-- ----------------------------------------------------------- report_queue ---
INSERT INTO report_queue (id, title, product_id, client, type, template, due, status)
SELECT
    pr.id || '-rq-' || q,
    'Weekly status — ' || pr.name,
    pr.id,
    pr.client_id,
    (ARRAY['Sprint Report','Client Report'])[1 + q % 2],
    'Standard',
    DATE '2026-07-25' + q * 7,
    (ARRAY['open','planned','done'])[1 + q % 3]
FROM products pr, generate_series(1, 2) q;

-- -------------------------------------------------- roles / lists / config ---
INSERT INTO roles (id, label, permissions) VALUES
    ('admin',    'Administrator', '{"all": true}'),
    ('lead',     'Delivery Lead', '{"read": true, "write": true}'),
    ('member',   'Team Member',   '{"read": true}'),
    ('observer', 'Observer',      '{"read": true}');

INSERT INTO master_lists (key, value, position)
SELECT k.key, v.value, v.pos - 1
FROM (VALUES ('priority'), ('task-status'), ('industry')) AS k(key),
     LATERAL (
        SELECT value, row_number() OVER () AS pos
        FROM unnest(CASE k.key
            WHEN 'priority'    THEN ARRAY['low','medium','high','critical']
            WHEN 'task-status' THEN ARRAY['selected','ready','in-progress','in-review','qa','done','blocked']
            ELSE ARRAY['Manufacturing','Banking','Energy','Automotive']
        END) AS value
     ) v;

INSERT INTO report_templates (id, name, audience, visibility, sections) VALUES
    ('tpl-sprint', 'Sprint Review',  'Delivery team', 'internal',
        ARRAY['Goal','Completed','Carried over','Risks']),
    ('tpl-client', 'Client Summary', 'Client sponsor', 'client-facing',
        ARRAY['Progress','Decisions needed','Next sprint']);

INSERT INTO workspace_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ANALYZE;
