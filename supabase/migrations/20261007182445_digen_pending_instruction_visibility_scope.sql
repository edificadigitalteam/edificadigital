-- Preserve hierarchy-scoped visibility for ordinary pending issues while allowing
-- the literal DIGEN Director to follow every instruction issued through DIGEN.
drop policy if exists unit_pending_issue_select on public.unit_pending_issue;
create policy unit_pending_issue_select
on public.unit_pending_issue
for select
to authenticated
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or unit_id = any(private.current_visible_unit_ids())
    or (
      origin = 'digen_instruction'
      and private.current_operator_is_digen_director(organization_id)
    )
  )
);
