-- Columns and tables the Next.js store has and the API did not.
--
-- The frontend ran on an in-memory prototype store until now. Wiring it to
-- this API showed every place its records carry a field the database had no
-- column for. This migration closes each gap in place, so the store can swap
-- its seed arrays for API calls without changing the shape a page reads.

-- ---------------------------------------------------------------- projects ---
-- A project files under the year it starts; an undated project has no folder.
ALTER TABLE projects
    ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- ------------------------------------------------------------------- tasks ---
-- due_date places a task on the sprint calendar. blockers replaces the single
-- blocked_reason/blocked_days pair: a task is rarely stopped by one thing, and
-- the board colours by the count. Each element is
--   {"id": "...", "category": "...", "text": "...", "days": 3}
ALTER TABLE tasks
    ADD COLUMN due_date DATE,
    ADD COLUMN blockers JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(blockers) = 'array');

UPDATE tasks
SET blockers = jsonb_build_array(jsonb_build_object(
        'id', id || '-blk-1',
        'category', 'Technical dependency',
        'text', blocked_reason,
        'days', blocked_days))
WHERE blocked_reason IS NOT NULL AND blocked_reason <> '';

ALTER TABLE tasks
    DROP COLUMN blocked_reason,
    DROP COLUMN blocked_days;

-- -------------------------------------------------------- report_templates ---
-- A section is an object now: a title, an on/off flag, prose with {{tokens}}
-- and an optional computed block. The old TEXT[] of titles becomes a list of
-- enabled, prose-less sections, which renders the same headings it did.
ALTER TABLE report_templates
    ADD COLUMN frequency TEXT   NOT NULL DEFAULT '',
    ADD COLUMN formats   TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE report_templates
    ADD COLUMN sections_json JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE report_templates t
SET sections_json = COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                   'id', trim(BOTH '-' FROM regexp_replace(lower(s), '[^a-z0-9]+', '-', 'g')),
                   'title', s,
                   'enabled', true,
                   'body', '',
                   'autoBlock', '') ORDER BY ord)
        FROM unnest(t.sections) WITH ORDINALITY AS u(s, ord)
    ), '[]'::jsonb);

ALTER TABLE report_templates DROP COLUMN sections;
ALTER TABLE report_templates RENAME COLUMN sections_json TO sections;

ALTER TABLE report_templates
    ADD CONSTRAINT report_templates_sections_array CHECK (jsonb_typeof(sections) = 'array');

-- ------------------------------------------------------------ master_lists ---
-- The settings pages key their lists the way the frontend does (industries,
-- contractTypes, ...). The three lists migration 000004 seeded under other
-- names are replaced; task-status duplicated the board_column CHECK and had
-- no screen.
DELETE FROM master_lists WHERE key IN ('priority', 'task-status', 'industry');

INSERT INTO master_lists (key, value, position)
SELECT k, v, ord - 1
FROM (VALUES
    ('industries',        ARRAY['Manufacturing','Banking','Heavy Equipment Rental','Automotive','Retail','Logistics']),
    ('contractTypes',     ARRAY['Retainer','Fixed scope','Project-based']),
    ('jobRoles',          ARRAY['Delivery Lead','System Analyst','Fullstack Developer','Backend Developer','Frontend Developer','QA Engineer','UI/UX Designer','Technical Writer']),
    ('skillTags',         ARRAY['FE','BE','QA','Data','AI','Infra','Documentation']),
    ('workItemTypes',     ARRAY['story','bug','task','spike']),
    ('priorities',        ARRAY['high','medium','low']),
    ('impactAreas',       ARRAY['Scope','Timeline','Cost','Quality']),
    ('blockerCategories', ARRAY['Waiting on client','Technical dependency','Waiting on a decision','Resourcing','External / vendor']),
    ('reportFrequencies', ARRAY['Weekly','Sprint-end','Monthly','Sprint-end / Monthly']),
    ('reportFormats',     ARRAY['Markdown','PDF','Slides'])
) AS lists(k, vals),
LATERAL unnest(vals) WITH ORDINALITY AS u(v, ord)
ON CONFLICT (key, value) DO NOTHING;

-- ------------------------------------------------------ workspace_settings ---
-- The settings page edits company, brand colour and sprint length; a fresh
-- database handed it an empty object and an empty DoD checklist.
UPDATE workspace_settings
SET settings = '{"company": "WIT ID", "brandColor": "#ED1C24", "sprintLengthDays": 10, "workingDaysPerWeek": 5}'::jsonb
WHERE settings = '{}'::jsonb;

UPDATE workspace_settings
SET dod_template = ARRAY['Code reviewed','Tests passing','QA passed','Documentation updated']
WHERE dod_template = '{}';

-- ------------------------------------------------- retro and review records ---
-- All four belong to a sprint: a retrospective looks back on one sprint, and a
-- review demos one sprint's work to the client.
CREATE TABLE retro_notes (
    id         TEXT PRIMARY KEY,
    sprint_id  TEXT        NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL CHECK (kind IN ('went-well', 'needs-improvement')),
    text       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX retro_notes_sprint_id_idx ON retro_notes (sprint_id);

CREATE TABLE retro_actions (
    id         TEXT PRIMARY KEY,
    sprint_id  TEXT        NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    action     TEXT        NOT NULL,
    owner_id   TEXT        REFERENCES members (id) ON DELETE SET NULL,
    due        DATE,
    status     TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX retro_actions_sprint_id_idx ON retro_actions (sprint_id);

CREATE TABLE demo_items (
    id         TEXT PRIMARY KEY,
    sprint_id  TEXT        NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    label      TEXT        NOT NULL,
    done       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX demo_items_sprint_id_idx ON demo_items (sprint_id);

CREATE TABLE client_feedback (
    id          TEXT PRIMARY KEY,
    sprint_id   TEXT        NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    from_name   TEXT        NOT NULL DEFAULT '',
    note        TEXT        NOT NULL,
    disposition TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX client_feedback_sprint_id_idx ON client_feedback (sprint_id);
