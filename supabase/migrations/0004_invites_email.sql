-- 0004: invitation details for the invite page, and a record of when an invitation email went out.
-- Safe to run more than once.

alter table public.invitations add column if not exists emailed_at timestamptz;

-- Anyone holding the secret token may see who the invitation is for, so the page can guide them
-- to sign up or sign in with the right email. Nothing else about the company is exposed.
create or replace function public.invitation_info(p_token uuid)
returns table (org_name text, email text, role text, status text)
language sql stable security definer set search_path = public as $$
  select o.name, i.email, i.role::text,
    case when i.accepted_at is not null then 'used' when i.expires_at <= now() then 'expired' else 'open' end
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token
$$;

revoke all on function public.invitation_info(uuid) from public;
grant execute on function public.invitation_info(uuid) to anon, authenticated;
