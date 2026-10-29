-- Tenda Desk: subscription payments through Selcom checkout.
-- Run after 0002_files_billing.sql. Safe to run more than once.

-- a Selcom payment carries its checkout order; it is approved by the server, never by the browser
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('mpesa', 'mixx', 'airtel', 'halopesa', 'bank', 'other', 'selcom'));
alter table public.payments add column if not exists order_id text unique;
alter table public.payments add column if not exists gateway_url text;
alter table public.payments add column if not exists gateway_transid text;

-- the price and length come from the plan, and the gateway fields only from the server functions
create or replace function public.payments_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plan plans;
begin
  select * into v_plan from plans where id = new.plan_id and active;
  if v_plan.id is null then raise exception 'unknown plan'; end if;
  new.months := v_plan.months;
  new.amount_tzs := v_plan.price_tzs;
  new.gateway_transid := null;
  return new;
end $$;

-- secrets only database functions can read: no policies, no grants
create table if not exists public.platform_secrets (
  key text primary key,
  value text not null
);
alter table public.platform_secrets enable row level security;
revoke all on public.platform_secrets from public, anon, authenticated;

-- the server's confirmation key, stored as a SHA-256 hash; set by a platform admin from the server
create or replace function public.set_gateway_key(p_hash text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad key'; end if;
  insert into platform_secrets (key, value) values ('gateway_key', p_hash)
  on conflict (key) do update set value = excluded.value;
end $$;
revoke all on function public.set_gateway_key(text) from public, anon;
grant execute on function public.set_gateway_key(text) to authenticated;

create or replace function public.gateway_ready()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_secrets where key = 'gateway_key');
$$;
revoke all on function public.gateway_ready() from public, anon;
grant execute on function public.gateway_ready() to authenticated;

-- billing fields may change inside the confirmation below as well as for platform admins
create or replace function public.organizations_guard_billing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.plan is distinct from old.plan
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.paid_until is distinct from old.paid_until)
     and not public.is_platform_admin()
     and coalesce(current_setting('tenda.gateway', true), '') <> 'on' then
    raise exception 'subscription fields can only be changed by Tenda Desk';
  end if;
  return new;
end $$;

-- called by the server after Selcom's own order status says COMPLETED; the key proves it is the server
create or replace function public.gateway_confirm_payment(p_order text, p_transid text, p_amount numeric, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_pay payments;
begin
  select value into v_hash from platform_secrets where key = 'gateway_key';
  if v_hash is null or p_key is null or encode(sha256(convert_to(p_key, 'UTF8')), 'hex') <> v_hash then
    raise exception 'not allowed';
  end if;
  select * into v_pay from payments where order_id = p_order and method = 'selcom' for update;
  if v_pay.id is null then return 'unknown'; end if;
  if v_pay.status = 'approved' then return 'approved'; end if;
  if v_pay.status <> 'pending' then return v_pay.status; end if;
  if p_amount is null or p_amount < v_pay.amount_tzs then return 'short'; end if;

  update payments set status = 'approved', gateway_transid = left(p_transid, 100), reviewed_at = now(),
    note = 'Selcom'
  where id = v_pay.id;
  perform set_config('tenda.gateway', 'on', true);
  -- paid time starts after any time the company still has left
  update organizations
  set plan = v_pay.plan_id,
      paid_until = greatest(now(), coalesce(paid_until, now()), trial_ends_at) + make_interval(months => v_pay.months)
  where id = v_pay.org_id;
  perform set_config('tenda.gateway', '', true);
  return 'approved';
end $$;
revoke all on function public.gateway_confirm_payment(text, text, numeric, text) from public;
grant execute on function public.gateway_confirm_payment(text, text, numeric, text) to anon, authenticated;

-- a checkout the customer abandoned or Selcom refused
create or replace function public.gateway_close_payment(p_order text, p_status text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  select value into v_hash from platform_secrets where key = 'gateway_key';
  if v_hash is null or p_key is null or encode(sha256(convert_to(p_key, 'UTF8')), 'hex') <> v_hash then
    raise exception 'not allowed';
  end if;
  update payments set status = 'rejected', note = left('Selcom: ' || coalesce(p_status, ''), 200), reviewed_at = now()
  where order_id = p_order and method = 'selcom' and status = 'pending';
end $$;
revoke all on function public.gateway_close_payment(text, text, text) from public;
grant execute on function public.gateway_close_payment(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
