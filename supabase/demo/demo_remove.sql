-- Removes the demo data that demo_seed.sql added. Real tenders and documents are not touched.
-- Paste into the Supabase SQL Editor and press Run. Use the same company name as in demo_seed.sql.
do $$
declare
  v_org uuid;
  n int;
begin
  select count(*), min(id::text)::uuid into n, v_org
  from public.organizations where upper(trim(name)) = upper('TEMBO CLOUD COMPANY');  -- COMPANY
  if n <> 1 then raise exception 'Company not found, or more than one has that name.'; end if;
  -- deleting a tender also removes its pricing, checklist, contract, deliveries, invoices and history
  delete from public.tenders where org_id = v_org and tender_no like 'DEMO-%';
  delete from public.company_documents where org_id = v_org and title like '[DEMO]%';
  delete from public.invitations where org_id = v_org and email = 'afisa.demo@example.com' and accepted_at is null;
  raise notice 'Demo data removed from company %', v_org;
end $$;
