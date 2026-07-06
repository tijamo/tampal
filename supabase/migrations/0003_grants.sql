-- =============================================================================
-- Table-level grants
--
-- On Supabase Cloud the platform grants these automatically; a self-hosted
-- stack (self-hosting/) has no equivalent bootstrap, so without this every
-- query against these tables is rejected with "permission denied for table
-- x" before RLS is even consulted -- GRANT is a separate, earlier check than
-- the RLS policies defined in 0001_init.sql, which remain the actual
-- security boundary.
-- =============================================================================
grant select, insert, update, delete
  on profiles, people, meetings, attendance, consents, audit_log
  to authenticated, service_role;
