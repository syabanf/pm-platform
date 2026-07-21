-- WIT Sprint OS — initial schema
--
-- Hierarchy: client -> project -> product -> module -> sprint
-- NOTE ON NAMING: table names follow the frontend's code identifiers, so the
-- API maps 1:1 onto the existing TypeScript types. In the product UI these
-- read as:  products = "Module",  modules = "Component".
--   clients -> projects -> products("Module") -> modules("Component") -> sprints

-- ---------------------------------------------------------------- clients ---
CREATE TABLE clients (
    id            TEXT PRIMARY KEY,
    name          TEXT        NOT NULL,
    industry      TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive', 'prospect')),
    client_pic    TEXT        NOT NULL DEFAULT '',
    wit_owner     TEXT        NOT NULL DEFAULT '',
    contract_type TEXT        NOT NULL DEFAULT '',
    health        TEXT        NOT NULL DEFAULT 'healthy'
                              CHECK (health IN ('healthy', 'warning', 'at-risk')),
    risk          TEXT        NOT NULL DEFAULT 'low'
                              CHECK (risk IN ('low', 'medium', 'high')),
    notes         TEXT        NOT NULL DEFAULT '',
    action_needed TEXT[]      NOT NULL DEFAULT '{}',
    ai_insight    JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------- projects ---
CREATE TABLE projects (
    id         TEXT PRIMARY KEY,
    client_id  TEXT        NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    objective  TEXT        NOT NULL DEFAULT '',
    status     TEXT        NOT NULL DEFAULT 'discovery'
                           CHECK (status IN ('discovery', 'active', 'done', 'on-hold')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_client_id_idx ON projects (client_id);

-- ------------------------------------------------- products (UI "Module") ---
CREATE TABLE products (
    id                TEXT PRIMARY KEY,
    project_id        TEXT        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    -- denormalised so a product can be listed per client without a join,
    -- mirroring the frontend Product type.
    client_id         TEXT        NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    name              TEXT        NOT NULL,
    goal              TEXT        NOT NULL DEFAULT '',
    owner             TEXT        NOT NULL DEFAULT '',
    delivery_lead     TEXT        NOT NULL DEFAULT '',
    status            TEXT        NOT NULL DEFAULT 'discovery'
                                  CHECK (status IN ('discovery', 'development', 'release', 'maintenance')),
    health            INTEGER     NOT NULL DEFAULT 100 CHECK (health BETWEEN 0 AND 100),
    risk              TEXT        NOT NULL DEFAULT 'low'
                                  CHECK (risk IN ('low', 'medium', 'high')),
    velocity          INTEGER     NOT NULL DEFAULT 0,
    blocked_count     INTEGER     NOT NULL DEFAULT 0,
    -- set once a sprint exists; FK added after the sprints table below.
    current_sprint_id TEXT,
    ai_insight        JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_project_id_idx ON products (project_id);
CREATE INDEX products_client_id_idx ON products (client_id);

-- ------------------------------------------------ modules (UI "Component") ---
CREATE TABLE modules (
    id         TEXT PRIMARY KEY,
    product_id TEXT        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    owner      TEXT        NOT NULL DEFAULT 'Unassigned',
    status     TEXT        NOT NULL DEFAULT 'planned'
                           CHECK (status IN ('planned', 'in-progress', 'done')),
    position   INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX modules_product_id_idx ON modules (product_id, position);

-- ---------------------------------------------------------------- members ---
CREATE TABLE members (
    id            TEXT PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    role          TEXT        NOT NULL DEFAULT '',
    role_label    TEXT        NOT NULL DEFAULT '',
    skill_tags    TEXT[]      NOT NULL DEFAULT '{}',
    allocation    INTEGER     NOT NULL DEFAULT 100,
    capacity_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
    workload      INTEGER     NOT NULL DEFAULT 0,
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive', 'temporary')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------- backlog_items ---
CREATE TABLE backlog_items (
    id                  TEXT PRIMARY KEY,
    product_id          TEXT        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    module_id           TEXT        REFERENCES modules (id) ON DELETE SET NULL,
    title               TEXT        NOT NULL,
    story               TEXT        NOT NULL DEFAULT '',
    acceptance_criteria TEXT[]      NOT NULL DEFAULT '{}',
    type                TEXT        NOT NULL DEFAULT 'story',
    priority            TEXT        NOT NULL DEFAULT 'medium',
    readiness           TEXT        NOT NULL DEFAULT 'draft'
                                    CHECK (readiness IN ('ready', 'needs-clarification', 'draft')),
    estimate            INTEGER     NOT NULL DEFAULT 0,
    ai_suggestions      TEXT[]      NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX backlog_items_product_id_idx ON backlog_items (product_id);
CREATE INDEX backlog_items_module_id_idx ON backlog_items (module_id);

-- ---------------------------------------------------------------- sprints ---
CREATE TABLE sprints (
    id           TEXT PRIMARY KEY,
    product_id   TEXT        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    -- the Component that owns this sprint (5-level hierarchy)
    module_id    TEXT        REFERENCES modules (id) ON DELETE SET NULL,
    number       INTEGER     NOT NULL,
    name         TEXT        NOT NULL DEFAULT '',
    goal         TEXT        NOT NULL DEFAULT '',
    start_date   DATE,
    end_date     DATE,
    working_days INTEGER     NOT NULL DEFAULT 10,
    days_left    INTEGER     NOT NULL DEFAULT 10,
    status       TEXT        NOT NULL DEFAULT 'planning'
                             CHECK (status IN ('planning', 'active', 'review', 'done')),
    committed    INTEGER     NOT NULL DEFAULT 0,
    completed    INTEGER     NOT NULL DEFAULT 0,
    progress     INTEGER     NOT NULL DEFAULT 0,
    risk         TEXT        NOT NULL DEFAULT 'low'
                             CHECK (risk IN ('low', 'medium', 'high')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, number)
);
CREATE INDEX sprints_product_id_idx ON sprints (product_id);
CREATE INDEX sprints_module_id_idx ON sprints (module_id);

-- products.current_sprint_id closes the cycle once sprints exists.
ALTER TABLE products
    ADD CONSTRAINT products_current_sprint_id_fkey
    FOREIGN KEY (current_sprint_id) REFERENCES sprints (id) ON DELETE SET NULL;

-- --------------------------------------------------------- sprint_members ---
CREATE TABLE sprint_members (
    sprint_id     TEXT          NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    member_id     TEXT          NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    allocation    INTEGER       NOT NULL DEFAULT 100,
    capacity_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (sprint_id, member_id)
);

-- --------------------------------------------------- sprint_backlog_items ---
CREATE TABLE sprint_backlog_items (
    sprint_id       TEXT    NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    backlog_item_id TEXT    NOT NULL REFERENCES backlog_items (id) ON DELETE CASCADE,
    position        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sprint_id, backlog_item_id)
);

-- ------------------------------------------------------------------ tasks ---
CREATE TABLE tasks (
    id              TEXT PRIMARY KEY,
    sprint_id       TEXT        NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    backlog_item_id TEXT        NOT NULL REFERENCES backlog_items (id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    module_name     TEXT        NOT NULL DEFAULT '',
    assignee_id     TEXT        REFERENCES members (id) ON DELETE SET NULL,
    estimate        INTEGER     NOT NULL DEFAULT 0,
    -- "column" is a reserved word in SQL; the API still exposes it as `column`.
    board_column    TEXT        NOT NULL DEFAULT 'selected'
                                CHECK (board_column IN ('selected', 'ready', 'in-progress',
                                                        'in-review', 'qa', 'done', 'blocked')),
    priority        TEXT        NOT NULL DEFAULT 'medium',
    blocked_reason  TEXT,
    blocked_days    INTEGER,
    off_goal        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_sprint_id_idx ON tasks (sprint_id);
CREATE INDEX tasks_backlog_item_id_idx ON tasks (backlog_item_id);
CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);

-- --------------------------------------------------------------- task_dod ---
CREATE TABLE task_dod (
    task_id  TEXT    NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    label    TEXT    NOT NULL,
    done     BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (task_id, position)
);

-- -------------------------------------------------------------- decisions ---
CREATE TABLE decisions (
    id         TEXT PRIMARY KEY,
    product_id TEXT        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    decided_on DATE        NOT NULL DEFAULT CURRENT_DATE,
    title      TEXT        NOT NULL,
    detail     TEXT        NOT NULL DEFAULT '',
    owner      TEXT        NOT NULL DEFAULT '',
    status     TEXT        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'decided')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX decisions_product_id_idx ON decisions (product_id);

-- ------------------------------------------------------- report_templates ---
CREATE TABLE report_templates (
    id         TEXT PRIMARY KEY,
    name       TEXT        NOT NULL UNIQUE,
    audience   TEXT        NOT NULL DEFAULT '',
    visibility TEXT        NOT NULL DEFAULT 'internal'
                           CHECK (visibility IN ('internal', 'client-facing')),
    sections   TEXT[]      NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------- report_queue ---
CREATE TABLE report_queue (
    id         TEXT PRIMARY KEY,
    title      TEXT        NOT NULL,
    product_id TEXT        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    client     TEXT        NOT NULL DEFAULT '',
    type       TEXT        NOT NULL,
    template   TEXT        NOT NULL DEFAULT '',
    due        DATE,
    status     TEXT        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'planned', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_queue_product_id_idx ON report_queue (product_id);

-- ------------------------------------------------------ generated_reports ---
CREATE TABLE generated_reports (
    id           TEXT PRIMARY KEY,
    product_id   TEXT        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    sprint_id    TEXT        REFERENCES sprints (id) ON DELETE SET NULL,
    type         TEXT        NOT NULL,
    template     TEXT        NOT NULL DEFAULT '',
    period       TEXT        NOT NULL DEFAULT '',
    generated_on DATE        NOT NULL DEFAULT CURRENT_DATE,
    status       TEXT        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'sent')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX generated_reports_product_id_idx ON generated_reports (product_id);

-- ------------------------------------------------------------------ roles ---
CREATE TABLE roles (
    id          TEXT PRIMARY KEY,
    label       TEXT   NOT NULL,
    permissions JSONB  NOT NULL DEFAULT '{}'::jsonb
);

-- ----------------------------------------------------------- master_lists ---
-- Settings > Lists: one row per (list key, value), ordered.
CREATE TABLE master_lists (
    key      TEXT    NOT NULL,
    value    TEXT    NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, value)
);

-- ------------------------------------------------------ workspace_settings --
-- Single-row workspace config + the Definition of Done template.
CREATE TABLE workspace_settings (
    id           BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    name         TEXT        NOT NULL DEFAULT 'WIT Sprint OS',
    settings     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    dod_template TEXT[]      NOT NULL DEFAULT '{}',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
