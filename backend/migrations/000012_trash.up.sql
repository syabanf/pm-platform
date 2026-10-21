-- Deleting a client, project or module cascades through the whole subtree.
-- Undo used to recreate that subtree row by row from the browser, which hit
-- the rate limit on anything sizeable and stopped halfway. The delete now
-- files the subtree here first, as one JSON document per table, and a
-- restore puts every row back in one transaction. Rows older than 30 days are
-- swept on the next delete.
CREATE TABLE trash (
    id         TEXT        PRIMARY KEY,
    kind       TEXT        NOT NULL CHECK (kind IN ('client', 'project', 'module')),
    root_id    TEXT        NOT NULL,
    label      TEXT        NOT NULL DEFAULT '',
    payload    JSONB       NOT NULL,
    deleted_by TEXT        NOT NULL DEFAULT '',
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trash_deleted_at_idx ON trash (deleted_at);
