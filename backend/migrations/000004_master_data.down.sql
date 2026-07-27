-- Inverse of 000004_master_data.up.sql. Removes only the rows this migration
-- seeds, by their known ids/keys, so a database that has since grown its own
-- roles, list values, templates or members keeps them.

DELETE FROM members WHERE id = 'mbr-owner';

DELETE FROM report_templates WHERE id IN ('tpl-sprint', 'tpl-client');

DELETE FROM master_lists WHERE
    (key = 'priority'    AND value IN ('low','medium','high','critical')) OR
    (key = 'task-status' AND value IN ('selected','ready','in-progress','in-review','qa','done','blocked')) OR
    (key = 'industry'    AND value IN ('Manufacturing','Banking','Energy','Automotive'));

DELETE FROM roles WHERE id IN ('admin', 'lead', 'member', 'observer');
