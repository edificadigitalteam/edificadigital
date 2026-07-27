-- Corrective: 20260727040000_organization_language_preference.sql recreated
-- admin_list_organizations() via `drop function` + `create function` (required
-- to add the new `language` OUT column) but forgot to reinstate the grants
-- the original definition had — `drop function` wipes them, silently
-- re-exposing the RPC to `anon` until this fix. Reinstates the original
-- revoke-from-public/anon, grant-to-authenticated-only posture.

revoke all on function public.admin_list_organizations() from public, anon;
grant execute on function public.admin_list_organizations() to authenticated;
