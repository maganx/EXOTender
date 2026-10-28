-- Tenda Desk 0002: bid files per tender, Claude document reader usage,
-- subscriptions with manual mobile-money payments, platform admins.
-- Run once in the Supabase SQL Editor after 0001_init.sql.

-- ---------- platform admins (the people who run Tenda Desk itself) ----------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy padmin_self on public.platform_admins for select using (user_id = auth.uid());

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- ---------- files uploaded for a tender (tender document, bid documents) ----------
create table public.tender_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  tender_id uuid not null references public.tenders (id) on delete cascade,
  tender_document_id uuid references public.tender_documents (id) on delete set null,
  kind text not null default 'bid' check (kind in ('tender', 'bid', 'other')),
  title text not null check (length(title) between 1 and 300),
  storage_path text not null unique,   -- <org_id>/tenders/<tender_id>/<uuid>-<filename> in bucket company-docs
  size_bytes bigint,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.tender_files (tender_id);
alter table public.tender_files enable row level security;
create policy tfile_read on public.tender_files for select using (public.is_member(org_id));
create policy tfile_insert on public.tender_files for insert with check (
  public.can_edit_tenders(org_id)
  and public.tender_org(tender_id) = org_id
  and storage_path like org_id::text || '/tenders/' || tender_id::text || '/%'
);
create policy tfile_update on public.tender_files for update
  using (public.can_edit_tenders(org_id))
  with check (public.can_edit_tenders(org_id) and public.tender_org(tender_id) = org_id);
create policy tfile_delete on public.tender_files for delete using (public.can_edit_tenders(org_id));

-- ---------- Claude reads of tender documents (for monthly limits) ----------
create table public.ai_reads (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  tender_id uuid references public.tenders (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  input_tokens int,
  output_tokens int,
  at timestamptz not null default now()
);
create index on public.ai_reads (org_id, at);
alter table public.ai_reads enable row level security;
create policy ai_read on public.ai_reads for select using (public.is_member(org_id) or public.is_platform_admin());
create policy ai_insert on public.ai_reads for insert with check (public.can_edit_tenders(org_id) and user_id = auth.uid());

-- ---------- subscriptions ----------
alter table public.organizations
  add column trial_ends_at timestamptz not null default now() + interval '14 days',
  add column paid_until timestamptz;

-- companies cannot extend their own subscription; only payment approval does
create or replace function public.organizations_guard_billing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.plan is distinct from old.plan
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.paid_until is distinct from old.paid_until)
     and not public.is_platform_admin() then
    raise exception 'subscription fields can only be changed by Tenda Desk';
  end if;
  return new;
end $$;
create trigger organizations_guard_billing before update on public.organizations
  for each row execute function public.organizations_guard_billing();

create policy org_read_platform on public.organizations for select using (public.is_platform_admin());

create table public.plans (
  id text primary key,
  name_sw text not null,
  name_en text not null,
  months int not null check (months between 1 and 36),
  price_tzs numeric(14, 2) not null check (price_tzs >= 0),
  active boolean not null default true,
  sort int not null default 0
);
alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated using (true);
create policy plans_admin on public.plans for all using (public.is_platform_admin()) with check (public.is_platform_admin());
insert into public.plans (id, name_sw, name_en, months, price_tzs, sort) values
  ('month', 'Mwezi 1', '1 month', 1, 50000, 1),
  ('quarter', 'Miezi 3', '3 months', 3, 135000, 2),
  ('year', 'Mwaka 1', '1 year', 12, 480000, 3)
on conflict (id) do nothing;

-- payments a company reports (mobile money / bank), approved by a platform admin
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  months int not null,
  amount_tzs numeric(14, 2) not null,
  method text not null check (method in ('mpesa', 'mixx', 'airtel', 'halopesa', 'bank', 'other')),
  reference text not null check (length(reference) between 3 and 100),
  payer_phone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  submitted_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.payments (org_id, created_at desc);
create index on public.payments (status);
alter table public.payments enable row level security;
create policy pay_read on public.payments for select using (
  public.has_role(org_id, array['owner', 'admin', 'finance']::public.org_role[]) or public.is_platform_admin()
);
create policy pay_insert on public.payments for insert with check (
  public.has_role(org_id, array['owner', 'admin', 'finance']::public.org_role[])
  and status = 'pending' and reviewed_by is null and reviewed_at is null
  and submitted_by = auth.uid()
);

-- the price and length come from the plan, not from the browser
create or replace function public.payments_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plan plans;
begin
  select * into v_plan from plans where id = new.plan_id and active;
  if v_plan.id is null then raise exception 'unknown plan'; end if;
  new.months := v_plan.months;
  new.amount_tzs := v_plan.price_tzs;
  return new;
end $$;
create trigger payments_fill before insert on public.payments for each row execute function public.payments_fill();

create or replace function public.review_payment(p_payment uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay payments;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  select * into v_pay from payments where id = p_payment for update;
  if v_pay.id is null or v_pay.status <> 'pending' then raise exception 'payment not pending'; end if;
  update payments set status = case when p_approve then 'approved' else 'rejected' end,
    note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_payment;
  if p_approve then
    -- paid time starts after any time the company still has left
    update organizations
    set plan = v_pay.plan_id,
        paid_until = greatest(now(), coalesce(paid_until, now()), trial_ends_at) + make_interval(months => v_pay.months)
    where id = v_pay.org_id;
  end if;
end $$;
revoke all on function public.review_payment(uuid, boolean, text) from public, anon;
grant execute on function public.review_payment(uuid, boolean, text) to authenticated;

-- give a company more time without a payment (e.g. a longer trial)
create or replace function public.extend_subscription(p_org uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  update organizations
  set paid_until = greatest(now(), coalesce(paid_until, now()), trial_ends_at) + make_interval(days => p_days)
  where id = p_org;
end $$;
revoke all on function public.extend_subscription(uuid, int) from public, anon;
grant execute on function public.extend_subscription(uuid, int) to authenticated;

-- every company for the platform admin page
create or replace function public.platform_companies()
returns table (id uuid, name text, created_at timestamptz, plan text, trial_ends_at timestamptz, paid_until timestamptz,
               members bigint, tenders bigint, owner_email text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.created_at, o.plan, o.trial_ends_at, o.paid_until,
    (select count(*) from memberships m where m.org_id = o.id),
    (select count(*) from tenders t where t.org_id = o.id),
    (select u.email::text from memberships m join auth.users u on u.id = m.user_id
      where m.org_id = o.id and m.role = 'owner' order by m.created_at limit 1)
  from organizations o
  where public.is_platform_admin()
  order by o.created_at desc;
$$;
revoke all on function public.platform_companies() from public, anon;
grant execute on function public.platform_companies() to authenticated;

-- payment instructions and other settings shown to every company
create table public.platform_settings (
  key text primary key,
  value text not null default ''
);
alter table public.platform_settings enable row level security;
create policy pset_read on public.platform_settings for select to authenticated using (true);
create policy pset_admin on public.platform_settings for all using (public.is_platform_admin()) with check (public.is_platform_admin());
insert into public.platform_settings (key, value) values
  ('pay_instructions', 'Lipa kwa M-Pesa / Mixx / Airtel Money kisha weka namba ya muamala hapa chini.')
on conflict (key) do nothing;

-- grants for the API roles (Supabase grants these on new tables by default; kept explicit for other setups)
grant select, insert, update, delete on public.tender_files to authenticated;
grant select, insert on public.ai_reads to authenticated;
grant select, insert on public.payments to authenticated;
grant select on public.plans, public.platform_settings, public.platform_admins to authenticated;
grant insert, update, delete on public.plans, public.platform_settings to authenticated;

notify pgrst, 'reload schema';
