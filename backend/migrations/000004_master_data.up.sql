-- Master (reference) data that every environment needs, not just a dev seed.
--
-- Roles, the settings lists and the report templates were only ever inserted by
-- backend/seed/seed.sql, which is a development convenience — a production
-- `migrate up` left those tables empty, so GET /roles and GET /lists/{key}
-- returned nothing and the settings screens had no options to offer. This puts
-- them where every migrated database gets them.
--
-- Every insert is idempotent (ON CONFLICT DO NOTHING), so re-running is safe and
-- the dev seeder — which truncates and reinserts its own copy — does not fight
-- with it.

-- ------------------------------------------------------------------ roles ---
INSERT INTO roles (id, label, permissions) VALUES
    ('admin',    'Administrator', '{"all": true}'),
    ('lead',     'Delivery Lead', '{"read": true, "write": true}'),
    ('member',   'Team Member',   '{"read": true}'),
    ('observer', 'Observer',      '{"read": true}')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------- master_lists ---
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

-- ------------------------------------------------------- report_templates ---
INSERT INTO report_templates (id, name, audience, visibility, sections) VALUES
    ('tpl-sprint', 'Sprint Review',  'Delivery team', 'internal',
        ARRAY['Goal','Completed','Carried over','Risks']),
    ('tpl-client', 'Client Summary', 'Client sponsor', 'client-facing',
        ARRAY['Progress','Decisions needed','Next sprint'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------- initial member ---
-- One member every environment starts with, so the app has a delivery lead to
-- assign work to and — since the frontend logs in as a member — someone to sign
-- in as before anyone has been added.
INSERT INTO members (id, name, email, role, role_label, skill_tags, allocation, capacity_days, status)
VALUES ('mbr-owner', 'WIT Admin', 'admin@wit.id',
        'admin', 'Administrator', ARRAY['PM'], 100, 10, 'active')
ON CONFLICT (id) DO NOTHING;
