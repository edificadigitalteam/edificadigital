-- The access overview reads only caller-visible membership metadata.
-- Run it with caller privileges to avoid adding a new public SECURITY DEFINER endpoint.
alter function public.pending_issue_access_overview(uuid) security invoker;
