create or replace function private.enforce_organization_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_seats integer;
  occupied_seats integer;
begin
  if new.organization_id is null or not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active and old.organization_id is not distinct from new.organization_id then
    return new;
  end if;

  select subscription.seat_limit
    into allowed_seats
  from public.organization_subscription subscription
  where subscription.organization_id = new.organization_id
    and subscription.status in ('trial','active','past_due')
  limit 1;

  -- A seat limit only exists when the organization's commercial subscription
  -- explicitly defines one. Organizations without a subscription record are
  -- not forced into an artificial one-user default.
  if allowed_seats is null then
    return new;
  end if;

  select count(*)
    into occupied_seats
  from private.operator_access access
  where access.organization_id = new.organization_id
    and access.active
    and access.id is distinct from new.id;

  if occupied_seats >= allowed_seats then
    raise exception using errcode = '23514', message = format('The organization has reached its limit of %s active users.', allowed_seats);
  end if;
  return new;
end;
$$;
