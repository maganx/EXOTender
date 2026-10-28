-- Tenda Desk: multi-company tender management
-- Every row belongs to one organization (company). Row Level Security keeps
-- each company's data invisible to every other company, and roles decide
-- what each member may see or change inside their own company.

create extension if not exists pgcrypto;

-- ---------- types ----------
create type public.org_role as enum ('owner', 'admin', 'officer', 'finance', 'viewer');
create type public.tender_stage as enum (
  'found', 'prep', 'submitted', 'eval', 'awarded', 'contract', 'supply', 'payment', 'closed', 'lost'
);
create type public.tender_category as enum ('goods', 'works', 'nc', 'cons');
create type public.doc_status as enum ('pending', 'done', 'na');
create type public.delivery_status as enum ('planned', 'delivered', 'accepted');

-- ---------- core ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 160),
  tin text,
  plan text not null default 'trial',
  settings jsonb not null default '{}'::jsonb,   -- e.g. {"nest_keywords": [...], "lang": "sw"}
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'viewer' check (role <> 'owner'),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.invitations (org_id);

-- ---------- tenders ----------
create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  tender_no text not null,
  title text not null,
  entity text,                         -- procuring entity
  category public.tender_category not null default 'goods',
  method text,
  region text,
  lead_user uuid references auth.users (id) on delete set null,
  stage public.tender_stage not null default 'found',
  published_at date,
  clarify_by date,
  deadline timestamptz,
  opening_at timestamptz,
  validity_days int not null default 90 check (validity_days between 1 and 730),
  bid_security_type text not null default 'decl' check (bid_security_type in ('decl', 'guar', 'none')),
  bid_security_amount numeric(16, 2),
  bid_security_expiry date,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'nest')),
  nest_url text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tender_no)
);
create index on public.tenders (org_id, stage);
create index on public.tenders (org_id, deadline);

-- pricing is its own table so a viewer can follow a tender without seeing our prices
create table public.tender_pricing (
  tender_id uuid primary key references public.tenders (id) on delete cascade,
  cost numeric(16, 2),
  transport numeric(16, 2),
  other numeric(16, 2),
  bid_price numeric(16, 2),            -- VAT inclusive
  updated_at timestamptz not null default now()
);

create table public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  std_key text,                        -- brela, tin, taxclear, ... or null for tender-specific
  label text not null,
  section text,                        -- where it goes in the bid / NeST
  note text,
  page int,
  status public.doc_status not null default 'pending',
  company_document_id uuid,            -- the vault file used for it, if any
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.tender_documents (tender_id);

create table public.tender_contracts (
  tender_id uuid primary key references public.tenders (id) on delete cascade,
  award_date date,
  award_amount numeric(16, 2),
  standstill_end date,
  accepted_at date,
  contract_no text,
  signed_at date,
  contract_value numeric(16, 2),
  start_date date,
  end_date date,
  lpo_no text,
  ps_amount numeric(16, 2),
  ps_expiry date,
  ps_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  item text not null default '',
  qty text,
  delivery_date date,
  delivery_note text,
  status public.delivery_status not null default 'planned',
  created_at timestamptz not null default now()
);
create index on public.deliveries (tender_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  invoice_no text,
  invoice_date date,
  amount numeric(16, 2) not null default 0,
  paid numeric(16, 2) not null default 0,
  paid_on date,
  created_at timestamptz not null default now()
);
create index on public.invoices (tender_id);

create table public.activity_log (
  id bigint generated always as identity primary key,
  tender_id uuid not null references public.tenders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  text text not null check (length(text) <= 2000)
);
create index on public.activity_log (tender_id, at desc);

-- company document vault: BRELA, TIN, tax clearance... reused across tenders
create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,                  -- brela, tin, taxclear, vat, license, ...
  title text not null,
  storage_path text not null,          -- <org_id>/<uuid>-<filename> in bucket company-docs
  expires_on date,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.company_documents (org_id);
alter table public.tender_documents
  add constraint tender_documents_company_document_fk
  foreign key (company_document_id) references public.company_documents (id) on delete set null;

-- ---------- helpers ----------
create or replace function public.has_role(p_org uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = auth.uid());
$$;

create or replace function public.tender_org(p_tender uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.tenders where id = p_tender;
$$;

-- role groups
create or replace function public.can_edit_tenders(p_org uuid) returns boolean
language sql stable as $$ select public.has_role(p_org, array['owner','admin','officer']::public.org_role[]) $$;
create or replace function public.can_see_money(p_org uuid) returns boolean
language sql stable as $$ select public.has_role(p_org, array['owner','admin','officer','finance']::public.org_role[]) $$;
create or replace function public.can_edit_payments(p_org uuid) returns boolean
language sql stable as $$ select public.has_role(p_org, array['owner','admin','finance']::public.org_role[]) $$;
create or replace function public.is_admin(p_org uuid) returns boolean
language sql stable as $$ select public.has_role(p_org, array['owner','admin']::public.org_role[]) $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger tenders_touch before update on public.tenders for each row execute function public.touch_updated_at();
create trigger pricing_touch before update on public.tender_pricing for each row execute function public.touch_updated_at();
create trigger contracts_touch before update on public.tender_contracts for each row execute function public.touch_updated_at();

-- a tender may not move to another company
create or replace function public.tenders_lock_org() returns trigger
language plpgsql as $$
begin
  if new.org_id <> old.org_id then raise exception 'tender cannot change company'; end if;
  return new;
end $$;
create trigger tenders_lock_org before update on public.tenders for each row execute function public.tenders_lock_org();

-- every company keeps at least one owner
create or replace function public.memberships_keep_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_org uuid := coalesce(old.org_id, new.org_id);
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (select 1 from memberships where org_id = v_org and role = 'owner' and user_id <> old.user_id) then
      raise exception 'a company must keep at least one owner';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger memberships_keep_owner before update or delete on public.memberships
  for each row execute function public.memberships_keep_owner();

-- only an owner can grant or take away the owner role
create or replace function public.memberships_owner_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- the very first owner of a new company is created by create_organization()
  if (new.role = 'owner' or (tg_op = 'UPDATE' and old.role = 'owner'))
     and exists (select 1 from public.memberships where org_id = new.org_id and role = 'owner')
     and not public.has_role(new.org_id, array['owner']::public.org_role[]) then
    raise exception 'only an owner can change owners';
  end if;
  return new;
end $$;
create trigger memberships_owner_guard before insert or update on public.memberships
  for each row execute function public.memberships_owner_guard();

-- new auth user -> profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- sign-up flow: the signed-in user creates a company and becomes its owner
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into organizations (name) values (p_name) returning id into v_org;
  insert into memberships (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  return v_org;
end $$;

-- accept an invitation sent to the signed-in user's email
create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv invitations;
begin
  select * into v_inv from invitations
  where token = p_token and accepted_at is null and expires_at > now()
    and lower(email) = lower(auth.jwt() ->> 'email');
  if v_inv.id is null then raise exception 'invitation not found or expired'; end if;
  insert into memberships (org_id, user_id, role) values (v_inv.org_id, auth.uid(), v_inv.role)
  on conflict (org_id, user_id) do nothing;
  update invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end $$;

revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ---------- row level security ----------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.tenders enable row level security;
alter table public.tender_pricing enable row level security;
alter table public.tender_documents enable row level security;
alter table public.tender_contracts enable row level security;
alter table public.deliveries enable row level security;
alter table public.invoices enable row level security;
alter table public.activity_log enable row level security;
alter table public.company_documents enable row level security;

-- organizations: members read, owner/admin update; creation only through create_organization()
create policy org_read on public.organizations for select using (public.is_member(id));
create policy org_update on public.organizations for update using (public.is_admin(id)) with check (public.is_admin(id));
create policy org_delete on public.organizations for delete using (public.has_role(id, array['owner']::public.org_role[]));

-- profiles: yourself, and people in your companies
create policy profile_read on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.memberships a join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy profile_write on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- memberships: members see the team; owner/admin manage it (owner changes guarded by trigger)
create policy mem_read on public.memberships for select using (public.is_member(org_id));
create policy mem_insert on public.memberships for insert with check (public.is_admin(org_id));
create policy mem_update on public.memberships for update using (public.is_admin(org_id)) with check (public.is_admin(org_id));
create policy mem_delete on public.memberships for delete using (public.is_admin(org_id) or user_id = auth.uid());

create policy inv_all on public.invitations for all using (public.is_admin(org_id)) with check (public.is_admin(org_id));

-- tenders: every member reads; owner/admin/officer write; owner/admin delete
create policy tender_read on public.tenders for select using (public.is_member(org_id));
create policy tender_insert on public.tenders for insert with check (public.can_edit_tenders(org_id));
create policy tender_update on public.tenders for update using (public.can_edit_tenders(org_id)) with check (public.can_edit_tenders(org_id));
create policy tender_delete on public.tenders for delete using (public.is_admin(org_id));

-- pricing: hidden from viewers
create policy price_read on public.tender_pricing for select using (public.can_see_money(public.tender_org(tender_id)));
create policy price_write on public.tender_pricing for all
  using (public.can_edit_tenders(public.tender_org(tender_id)))
  with check (public.can_edit_tenders(public.tender_org(tender_id)));

-- documents, contracts, deliveries: members read, tender editors write
create policy tdoc_read on public.tender_documents for select using (public.is_member(public.tender_org(tender_id)));
create policy tdoc_write on public.tender_documents for all
  using (public.can_edit_tenders(public.tender_org(tender_id)))
  with check (public.can_edit_tenders(public.tender_org(tender_id)));

create policy con_read on public.tender_contracts for select using (public.is_member(public.tender_org(tender_id)));
create policy con_write on public.tender_contracts for all
  using (public.can_edit_tenders(public.tender_org(tender_id)))
  with check (public.can_edit_tenders(public.tender_org(tender_id)));

create policy del_read on public.deliveries for select using (public.is_member(public.tender_org(tender_id)));
create policy del_write on public.deliveries for all
  using (public.can_edit_tenders(public.tender_org(tender_id)))
  with check (public.can_edit_tenders(public.tender_org(tender_id)));

-- invoices: money roles read; owner/admin/finance write
create policy invc_read on public.invoices for select using (public.can_see_money(public.tender_org(tender_id)));
create policy invc_write on public.invoices for all
  using (public.can_edit_payments(public.tender_org(tender_id)))
  with check (public.can_edit_payments(public.tender_org(tender_id)));

-- log: members read; anyone but a viewer adds their own notes; nobody edits history
create policy log_read on public.activity_log for select using (public.is_member(public.tender_org(tender_id)));
create policy log_insert on public.activity_log for insert with check (
  user_id = auth.uid()
  and public.has_role(public.tender_org(tender_id), array['owner','admin','officer','finance']::public.org_role[])
);

-- company document vault
create policy cdoc_read on public.company_documents for select using (public.is_member(org_id));
create policy cdoc_write on public.company_documents for all using (public.can_edit_tenders(org_id)) with check (public.can_edit_tenders(org_id));

-- ---------- storage: private bucket, folder per company ----------
insert into storage.buckets (id, name, public) values ('company-docs', 'company-docs', false)
on conflict (id) do nothing;

create policy cdocs_read on storage.objects for select using (
  bucket_id = 'company-docs' and public.is_member((storage.foldername(name))[1]::uuid)
);
create policy cdocs_insert on storage.objects for insert with check (
  bucket_id = 'company-docs' and public.can_edit_tenders((storage.foldername(name))[1]::uuid)
);
create policy cdocs_delete on storage.objects for delete using (
  bucket_id = 'company-docs' and public.can_edit_tenders((storage.foldername(name))[1]::uuid)
);
