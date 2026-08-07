-- A burndown chart needs history you cannot reconstruct after the fact: how many
-- points remained on each day of a sprint. The completed total is a single
-- current number; the shape of the burn is only knowable if it was recorded as
-- it happened. This table is that record — one row per sprint per day.
--
-- Velocity, by contrast, is derivable from the sprints table (completed points
-- per finished sprint), so it needs no snapshot; only burndown does.
-- The composite primary key (sprint_id, snapshot_on) is itself the index the
-- read "this sprint, in date order" needs — no separate index required.
CREATE TABLE sprint_daily_snapshots (
    sprint_id        TEXT    NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    snapshot_on      DATE    NOT NULL,
    remaining_points INTEGER NOT NULL,
    completed_points INTEGER NOT NULL,
    PRIMARY KEY (sprint_id, snapshot_on)
);
