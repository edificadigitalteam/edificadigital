revoke execute on function public.finance_access_overview(uuid) from public, anon;
revoke execute on function public.list_finance_funds(uuid) from public, anon;
revoke execute on function public.save_finance_fund(jsonb) from public, anon;
revoke execute on function public.record_finance_movement(jsonb) from public, anon;
revoke execute on function public.transfer_finance_funds(jsonb) from public, anon;
revoke execute on function public.save_finance_submission(jsonb) from public, anon;
revoke execute on function public.review_finance_submission(jsonb) from public, anon;
revoke execute on function public.record_finance_attachment(jsonb) from public, anon;
revoke execute on function public.save_unit_management_report_v2(jsonb) from public, anon;

grant execute on function public.finance_access_overview(uuid) to authenticated;
grant execute on function public.list_finance_funds(uuid) to authenticated;
grant execute on function public.save_finance_fund(jsonb) to authenticated;
grant execute on function public.record_finance_movement(jsonb) to authenticated;
grant execute on function public.transfer_finance_funds(jsonb) to authenticated;
grant execute on function public.save_finance_submission(jsonb) to authenticated;
grant execute on function public.review_finance_submission(jsonb) to authenticated;
grant execute on function public.record_finance_attachment(jsonb) to authenticated;
grant execute on function public.save_unit_management_report_v2(jsonb) to authenticated;
