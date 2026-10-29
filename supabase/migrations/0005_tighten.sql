-- 0005: closes gaps found in a review. Safe to run more than once.

-- 1. Only an owner may remove an owner. Before this an admin could remove one of two owners.
--    People may still leave a company themselves (the last owner is kept by memberships_keep_owner).
create or replace function public.memberships_owner_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- the company or the account itself is being deleted
    if not exists (select 1 from public.organizations where id = old.org_id)
       or not exists (select 1 from auth.users where id = old.user_id) then
      return old;
    end if;
    if old.role = 'owner' and old.user_id <> auth.uid()
       and not public.has_role(old.org_id, array['owner']::public.org_role[]) then
      raise exception 'only an owner can change owners';
    end if;
    return old;
  end if;
  -- the very first owner of a new company is created by create_organization()
  if (new.role = 'owner' or (tg_op = 'UPDATE' and old.role = 'owner'))
     and exists (select 1 from public.memberships where org_id = new.org_id and role = 'owner')
     and not public.has_role(new.org_id, array['owner']::public.org_role[]) then
    raise exception 'only an owner can change owners';
  end if;
  return new;
end $$;
drop trigger if exists memberships_owner_guard on public.memberships;
create trigger memberships_owner_guard before insert or update or delete on public.memberships
  for each row execute function public.memberships_owner_guard();

-- Deleting a company, or deleting a user in Supabase Auth, removes their memberships too;
-- the "keep one owner" rule must not block that.
create or replace function public.memberships_keep_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_org uuid := coalesce(old.org_id, new.org_id);
begin
  if tg_op = 'DELETE' and (not exists (select 1 from organizations where id = old.org_id)
                           or not exists (select 1 from auth.users where id = old.user_id)) then
    return old;
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (select 1 from memberships where org_id = v_org and role = 'owner' and user_id <> old.user_id) then
      raise exception 'a company must keep at least one owner';
    end if;
  end if;
  return coalesce(new, old);
end $$;

-- 2. People join a company only by accepting an invitation (or by creating the company).
--    Both go through security-definer functions, so the app never inserts memberships directly,
--    and an admin can no longer add someone's account without that person agreeing.
drop policy if exists mem_insert on public.memberships;

-- 3. A tender file record must keep pointing inside its own tender's folder.
drop policy if exists tfile_update on public.tender_files;
create policy tfile_update on public.tender_files for update
  using (public.can_edit_tenders(org_id))
  with check (
    public.can_edit_tenders(org_id)
    and public.tender_org(tender_id) = org_id
    and storage_path like org_id::text || '/tenders/' || tender_id::text || '/%'
  );

-- company vault records likewise stay inside the company's folder
drop policy if exists cdoc_write on public.company_documents;
create policy cdoc_write on public.company_documents for all
  using (public.can_edit_tenders(org_id))
  with check (public.can_edit_tenders(org_id) and storage_path like org_id::text || '/%');

notify pgrst, 'reload schema';
