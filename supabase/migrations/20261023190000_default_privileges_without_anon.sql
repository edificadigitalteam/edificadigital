-- Default privileges without anon (#144).
--
-- Every migration runs as postgres, and the default privileges of postgres in
-- public still granted everything to anon on each new table, sequence and
-- function, plus TRUNCATE/REFERENCES/TRIGGER/MAINTAIN to authenticated on new
-- tables. Database rule 14 asked each migration to revoke them by hand. This
-- removes them at the source for tables and sequences. authenticated and service_role keep their other
-- default privileges.
--
-- The default privileges of supabase_admin cannot be changed from postgres;
-- no migration creates objects as supabase_admin.

alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
-- For functions this removes only the explicit anon entry: Postgres grants
-- EXECUTE to PUBLIC globally, and per-schema default privileges can only add
-- to that. Changing the global default would also hit the private helpers
-- that RLS policies call, so new functions still need
-- `revoke execute ... from public, anon` in their migration (rule 14), and
-- supabase/tests/030 fails when anon can execute anything beyond the three
-- intentionally public RPCs.
alter default privileges for role postgres in schema public
  revoke all on functions from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;

-- MAINTAIN (VACUUM, ANALYZE, REINDEX, LOCK TABLE), new in Postgres 17, was
-- missed by 20261023164700 (#143): authenticated still held it on 35 tables
-- and inventory_lot_balance. PostgREST never exposes it.
revoke maintain on all tables in schema public from authenticated;

-- Two trigger functions kept the automatic execute for anon. Triggers never
-- check EXECUTE when they fire, and a trigger function cannot be called
-- directly, so only the three intentionally public RPCs stay executable by anon:
-- confirm_operator_activation, request_login_access and resolve_tenant_host.
revoke execute on function public.set_updated_at(), public.ensure_in_kind_shipment_donation() from public, anon;
