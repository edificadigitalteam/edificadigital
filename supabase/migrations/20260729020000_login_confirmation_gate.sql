-- Block the magic-link login itself for an operator whose email is not yet
-- confirmed, instead of letting Supabase Auth issue a session and only then
-- showing a blocked screen inside the app. Reuses the existing
-- activation_token/email_confirmed_at mechanism and email delivery path
-- (private.notify_operator_invitation) introduced for admin-invited
-- operators -- only the trigger point changes: a self-service resend at
-- login-request time, not only an admin-triggered one.
--
-- Anon-callable (the caller has no Supabase Auth session yet at this point)
-- and deliberately non-enumerating: an unknown email, an inactive operator,
-- and an unconfirmed operator all return the same {"ready": false}. Only a
-- confirmed, active operator gets {"ready": true}, telling the frontend it
-- is safe to proceed with the real supabase.auth.signInWithOtp call.
--
-- Self-service resend is rate-limited to once per 5 minutes per operator
-- (based on the existing updated_at column) so this anon-callable endpoint
-- cannot be used to spam an operator's inbox.

create or replace function public.request_login_access(target_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target private.operator_access%rowtype;
begin
  select * into target
  from private.operator_access
  where lower(email) = lower(target_email);

  if target.id is null or not target.active then
    return jsonb_build_object('ready', false);
  end if;

  if target.email_confirmed_at is not null then
    return jsonb_build_object('ready', true);
  end if;

  if target.activation_token is null or target.updated_at < now() - interval '5 minutes' then
    update private.operator_access
    set activation_token = gen_random_uuid(),
        activation_token_expires_at = now() + interval '7 days',
        updated_at = now()
    where id = target.id;

    perform private.notify_operator_invitation(target.id);
  end if;

  return jsonb_build_object('ready', false);
end;
$$;

revoke all on function public.request_login_access(text) from public;
grant execute on function public.request_login_access(text) to anon, authenticated;
