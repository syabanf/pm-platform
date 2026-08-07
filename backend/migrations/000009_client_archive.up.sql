-- Archiving a client: a reversible hide, not the permanent cascade DELETE. A
-- delivery agency parts with a client and often comes back to them; losing the
-- whole history to a mis-click is the wrong default. DELETE still exists for a
-- true, permanent removal.
--
-- Scoped to the client on purpose. A full soft-delete of the subtree would need
-- deleted_at on every table and a filter on every child query; archiving hides
-- the client from the active portfolio and is the reversible option, while the
-- subtree stays intact underneath so a restore brings back a whole client.
ALTER TABLE clients ADD COLUMN archived_at TIMESTAMPTZ;

-- The common read is "active clients", so index the filter it uses.
CREATE INDEX clients_active_idx ON clients (name, id) WHERE archived_at IS NULL;
