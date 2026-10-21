DROP TABLE IF EXISTS client_feedback;
DROP TABLE IF EXISTS demo_items;
DROP TABLE IF EXISTS retro_actions;
DROP TABLE IF EXISTS retro_notes;

DELETE FROM master_lists WHERE key IN (
    'industries','contractTypes','jobRoles','skillTags','workItemTypes',
    'priorities','impactAreas','blockerCategories','reportFrequencies','reportFormats');
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
     ) v
ON CONFLICT (key, value) DO NOTHING;

ALTER TABLE report_templates DROP CONSTRAINT IF EXISTS report_templates_sections_array;
ALTER TABLE report_templates
    ADD COLUMN sections_titles TEXT[] NOT NULL DEFAULT '{}';
UPDATE report_templates t
SET sections_titles = COALESCE((
        SELECT array_agg(s ->> 'title' ORDER BY ord)
        FROM jsonb_array_elements(t.sections) WITH ORDINALITY AS e(s, ord)
    ), '{}');
ALTER TABLE report_templates
    DROP COLUMN sections,
    DROP COLUMN frequency,
    DROP COLUMN formats;
ALTER TABLE report_templates RENAME COLUMN sections_titles TO sections;

ALTER TABLE tasks
    ADD COLUMN blocked_reason TEXT,
    ADD COLUMN blocked_days   INTEGER;
UPDATE tasks
SET blocked_reason = blockers -> 0 ->> 'text',
    blocked_days   = (blockers -> 0 ->> 'days')::integer
WHERE jsonb_array_length(blockers) > 0;
ALTER TABLE tasks
    DROP COLUMN blockers,
    DROP COLUMN due_date;

ALTER TABLE projects DROP COLUMN start_date;
