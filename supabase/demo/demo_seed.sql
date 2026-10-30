-- Tenda Desk demo data for one company.
-- Paste into the Supabase SQL Editor and press Run. Change the company name on the
-- line marked COMPANY if you want the demo in another company.
--
-- What it adds (all dates are relative to today, so the demo stays current):
--   16 tenders, every stage from Found to Closed plus Lost, with pricing, the bid
--   checklist, contracts, performance security, deliveries, invoices, payments and
--   activity history; 7 company documents (some about to expire, one expired); one
--   pending team invitation.
-- Every demo tender number starts with DEMO- and every demo document title starts
-- with [DEMO], so demo_remove.sql can take it all out again.
-- Running it twice replaces the earlier demo data, nothing is duplicated.

-- a date-time `d` days from today at hour `h`, East Africa Time
create or replace function pg_temp.dt(d int, h int default 10) returns timestamptz
language sql immutable as $$ select ((current_date + d)::timestamp + make_interval(hours => h)) at time zone 'Africa/Dar_es_Salaam' $$;

-- the standard bid checklist: the first `done` items are done, keys in `na` are not needed
create or replace function pg_temp.docs(p_tender uuid, p_org uuid, done int, na text[] default '{}') returns void
language plpgsql as $$
declare
  k text[] := array['brela','tin','taxclear','vat','license','nest','poa','bidform','price','specs','bidsec','mfr','literature','experience','financial'];
  l text[] := array['Cheti cha usajili wa kampuni (BRELA)','Cheti cha TIN','Tax clearance hai (TRA)','Cheti cha VAT','Leseni ya biashara','Usajili hai wa NeST','Power of attorney ya kusaini zabuni','Fomu ya zabuni imejazwa na kusainiwa','Price schedule / BOQ','Uzingatiaji wa specifications','Bid security / Bid Securing Declaration','Manufacturer''s authorization','Brochures / catalogues za bidhaa','Uzoefu: mikataba iliyotangulia','Hesabu za fedha zilizokaguliwa'];
  s text[] := array['Sehemu ya I: Sifa','Sehemu ya I: Sifa','Sehemu ya I: Sifa','Sehemu ya I: Sifa','Sehemu ya I: Sifa','Sehemu ya I: Sifa','Sehemu ya II: Fomu','Sehemu ya II: Fomu','Sehemu ya IV: Bei','Sehemu ya V: Specifications','Sehemu ya II: Fomu','Sehemu ya V: Specifications','Sehemu ya V: Specifications','Sehemu ya III: Uzoefu','Sehemu ya III: Fedha'];
  i int;
begin
  for i in 1..15 loop
    insert into public.tender_documents (tender_id, std_key, label, section, status, sort, company_document_id)
    values (
      p_tender, k[i], l[i], s[i],
      (case when k[i] = any (na) then 'na' when i <= done then 'done' else 'pending' end)::public.doc_status,
      i - 1,
      case when i <= done then (select id from public.company_documents where org_id = p_org and kind = k[i] and title like '[DEMO]%' limit 1) end
    );
  end loop;
end $$;

do $$
declare
  v_org uuid;
  v_user uuid;
  t uuid;
  n int;
begin
  select count(*), min(id::text)::uuid into n, v_org
  from public.organizations where upper(trim(name)) = upper('TEMBO CLOUD COMPANY');  -- COMPANY
  if n = 0 then raise exception 'Company not found. Check the name on the COMPANY line.'; end if;
  if n > 1 then raise exception 'More than one company has that name.'; end if;
  select user_id into v_user from public.memberships where org_id = v_org order by (role = 'owner') desc, created_at limit 1;

  -- start clean
  delete from public.tenders where org_id = v_org and tender_no like 'DEMO-%';
  delete from public.company_documents where org_id = v_org and title like '[DEMO]%';
  delete from public.invitations where org_id = v_org and email = 'afisa.demo@example.com' and accepted_at is null;

  -- ---------- company document vault ----------
  insert into public.company_documents (org_id, kind, title, storage_path, expires_on, uploaded_by) values
    (v_org, 'brela', '[DEMO] Cheti cha usajili BRELA', v_org || '/demo/brela.pdf', null, v_user),
    (v_org, 'tin', '[DEMO] Cheti cha TIN', v_org || '/demo/tin.pdf', null, v_user),
    (v_org, 'taxclear', '[DEMO] Tax clearance 2026', v_org || '/demo/taxclear.pdf', current_date + 12, v_user),
    (v_org, 'vat', '[DEMO] Cheti cha VAT', v_org || '/demo/vat.pdf', null, v_user),
    (v_org, 'license', '[DEMO] Leseni ya biashara Kundi A', v_org || '/demo/license.pdf', current_date - 5, v_user),
    (v_org, 'nest', '[DEMO] Usajili wa NeST', v_org || '/demo/nest.pdf', current_date + 40, v_user),
    (v_org, 'financial', '[DEMO] Hesabu zilizokaguliwa 2025', v_org || '/demo/financial.pdf', null, v_user);

  -- ---------- 1. Found: picked up from NeST ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, opening_at, source, nest_url, lead_user, created_by, notes)
  values (v_org, 'DEMO-MSD/HQ/G/2026-27/031', 'Ugavi wa vifaa tiba vya maabara', 'Bohari ya Dawa (MSD)', 'goods', 'National Competitive Tendering', 'Dar es Salaam', 'found',
    current_date - 3, pg_temp.dt(9), pg_temp.dt(9, 11), 'nest', 'https://nest.go.tz/tenders/published-tenders', v_user, v_user, 'Imeletwa na skani ya NeST ya kila siku.')
  returning id into t;
  perform pg_temp.docs(t, v_org, 0);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '3 days', 'Imeongezwa kutoka NeST');

  -- ---------- 2. Found: manual ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-DCC/G/2026-27/014', 'Ugavi wa samani za ofisi', 'Halmashauri ya Jiji la Dodoma', 'goods', 'Request for Quotations', 'Dodoma', 'found',
    current_date - 1, pg_temp.dt(20), v_user, v_user)
  returning id into t;
  perform pg_temp.docs(t, v_org, 0);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '1 day', 'Tenda imeundwa');

  -- ---------- 3. Preparing: closes in 2 days ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, clarify_by, deadline, opening_at, validity_days, bid_security_type, lead_user, created_by, notes)
  values (v_org, 'DEMO-TANESCO/G/2026/088', 'Ugavi wa transfoma 50 za 100kVA', 'TANESCO', 'goods', 'International Competitive Tendering', 'Dar es Salaam', 'prep',
    current_date - 18, current_date - 6, pg_temp.dt(2), pg_temp.dt(2, 11), 120, 'decl', v_user, v_user, 'Bei ya mtengenezaji imethibitishwa; tunasubiri barua ya manufacturer''s authorization.')
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 410000000, 18000000, 6500000, 498000000);
  perform pg_temp.docs(t, v_org, 9);
  insert into public.activity_log (tender_id, user_id, at, text) values
    (t, v_user, now() - interval '17 days', 'Tenda imeundwa'),
    (t, v_user, now() - interval '9 days', 'Hatua: Inaandaliwa'),
    (t, v_user, now() - interval '2 days', 'Bei imehifadhiwa');

  -- ---------- 4. Preparing: closes in 6 days ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, opening_at, bid_security_type, bid_security_amount, bid_security_expiry, lead_user, created_by)
  values (v_org, 'DEMO-UDSM/G/2026-27/205', 'Ugavi wa kompyuta 120 na printa 15', 'Chuo Kikuu cha Dar es Salaam', 'goods', 'National Competitive Tendering', 'Dar es Salaam', 'prep',
    current_date - 10, pg_temp.dt(6), pg_temp.dt(6, 11), 'guar', 4500000, current_date + 126, v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 214000000, 2500000, 3000000, 262000000);
  perform pg_temp.docs(t, v_org, 12, array['financial']);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '9 days', 'Tenda imeundwa'), (t, v_user, now() - interval '4 days', 'Hatua: Inaandaliwa');

  -- ---------- 5. Submitted: waiting for opening ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, opening_at, validity_days, lead_user, created_by)
  values (v_org, 'DEMO-DAWASA/NC/2026/019', 'Huduma ya usafi wa ofisi kwa mwaka mmoja', 'DAWASA', 'nc', 'National Competitive Tendering', 'Dar es Salaam', 'submitted',
    current_date - 30, pg_temp.dt(-3), pg_temp.dt(-3, 11), 90, v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 58000000, 0, 4000000, 73200000);
  perform pg_temp.docs(t, v_org, 15, array['mfr','literature']);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '28 days', 'Tenda imeundwa'), (t, v_user, now() - interval '3 days', 'Hatua: Imewasilishwa');

  -- ---------- 6. Evaluation: bid security runs out in 7 days ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, opening_at, validity_days, bid_security_type, bid_security_amount, bid_security_expiry, lead_user, created_by)
  values (v_org, 'DEMO-TPA/G/2026-27/044', 'Ugavi wa vifaa vya kuzima moto', 'Mamlaka ya Bandari Tanzania (TPA)', 'goods', 'National Competitive Tendering', 'Tanga', 'eval',
    current_date - 60, pg_temp.dt(-25), pg_temp.dt(-25, 11), 90, 'guar', 2800000, current_date + 7, v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 96000000, 5200000, 1800000, 121500000);
  perform pg_temp.docs(t, v_org, 15);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '25 days', 'Hatua: Imewasilishwa'), (t, v_user, now() - interval '24 days', 'Hatua: Tathmini');

  -- ---------- 7. Awarded: standstill ends in 10 days ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, opening_at, lead_user, created_by)
  values (v_org, 'DEMO-MOH/G/2026-27/112', 'Ugavi wa vitanda 200 vya hospitali', 'Wizara ya Afya', 'goods', 'National Competitive Tendering', 'Dodoma', 'awarded',
    current_date - 75, pg_temp.dt(-45), pg_temp.dt(-45, 11), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 142000000, 9500000, 2500000, 186000000);
  perform pg_temp.docs(t, v_org, 15);
  insert into public.tender_contracts (tender_id, award_date, award_amount, standstill_end) values (t, current_date - 4, 186000000, current_date + 10);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '45 days', 'Hatua: Imewasilishwa'), (t, v_user, now() - interval '4 days', 'Hatua: Tumeshinda');

  -- ---------- 8. Contract: signed, performance security expires in 20 days ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-TARURA/W/2026-27/007', 'Ukarabati wa ofisi za TARURA Kibaha', 'TARURA', 'works', 'National Competitive Tendering', 'Pwani', 'contract',
    current_date - 110, pg_temp.dt(-80), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 88000000, 3000000, 7000000, 117000000);
  perform pg_temp.docs(t, v_org, 15, array['mfr','literature']);
  insert into public.tender_contracts (tender_id, award_date, award_amount, standstill_end, accepted_at, contract_no, signed_at, contract_value, start_date, end_date, ps_amount, ps_expiry, ps_submitted)
  values (t, current_date - 40, 117000000, current_date - 26, current_date - 25, 'TARURA/PWN/W/2026/07', current_date - 18, 117000000, current_date + 3, current_date + 93, 11700000, current_date + 20, true);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '40 days', 'Hatua: Tumeshinda'), (t, v_user, now() - interval '18 days', 'Mkataba umesainiwa');

  -- ---------- 9. Supply: one delivery accepted, one coming ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-MNH/G/2026/063', 'Ugavi wa glovu na barakoa', 'Hospitali ya Taifa Muhimbili', 'goods', 'Request for Quotations', 'Dar es Salaam', 'supply',
    current_date - 95, pg_temp.dt(-70), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 31000000, 1200000, 800000, 41300000);
  perform pg_temp.docs(t, v_org, 15);
  insert into public.tender_contracts (tender_id, award_date, award_amount, contract_no, signed_at, contract_value, start_date, end_date, lpo_no, ps_submitted)
  values (t, current_date - 50, 41300000, 'MNH/LPO/2026/063', current_date - 41, 41300000, current_date - 40, current_date + 15, 'LPO-88341', false);
  insert into public.deliveries (tender_id, item, qty, delivery_date, delivery_note, status) values
    (t, 'Glovu za nitrile (boksi)', '1,200', current_date - 12, 'DN-0412', 'accepted'),
    (t, 'Barakoa za upasuaji (boksi)', '800', current_date + 6, null, 'planned');
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '41 days', 'Mkataba umesainiwa'), (t, v_user, now() - interval '12 days', 'Delivery imepokelewa');

  -- ---------- 10. Payment: half paid ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-KDC/G/2026/022', 'Ugavi wa vifaa vya kufundishia shule za msingi', 'Halmashauri ya Wilaya ya Kibaha', 'goods', 'National Competitive Tendering', 'Pwani', 'payment',
    current_date - 150, pg_temp.dt(-125), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 47000000, 2200000, 1300000, 62800000);
  perform pg_temp.docs(t, v_org, 15);
  insert into public.tender_contracts (tender_id, award_date, award_amount, contract_no, signed_at, contract_value, start_date, end_date, ps_amount, ps_expiry, ps_submitted)
  values (t, current_date - 100, 62800000, 'KDC/G/2026/22', current_date - 90, 62800000, current_date - 88, current_date - 30, 6280000, current_date + 60, true);
  insert into public.deliveries (tender_id, item, qty, delivery_date, delivery_note, status) values (t, 'Vitabu na chaki', 'Shule 24', current_date - 35, 'DN-0377', 'accepted');
  insert into public.invoices (tender_id, invoice_no, invoice_date, amount, paid, paid_on) values (t, 'INV-2026-031', current_date - 33, 62800000, 31400000, current_date - 6);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '33 days', 'Invoice imetolewa'), (t, v_user, now() - interval '6 days', 'Malipo ya awali yamepokelewa');

  -- ---------- 11. Payment: not paid after 70 days ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-RAS/MR/G/2026/009', 'Ugavi wa matairi ya magari', 'Sekretarieti ya Mkoa wa Morogoro', 'goods', 'Request for Quotations', 'Morogoro', 'payment',
    current_date - 165, pg_temp.dt(-140), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 19500000, 900000, 400000, 25900000);
  perform pg_temp.docs(t, v_org, 15, array['experience','financial']);
  insert into public.tender_contracts (tender_id, award_date, award_amount, contract_no, signed_at, contract_value, start_date, end_date, lpo_no)
  values (t, current_date - 120, 25900000, 'RAS/MR/LPO/09', current_date - 112, 25900000, current_date - 110, current_date - 80, 'LPO-20931');
  insert into public.deliveries (tender_id, item, qty, delivery_date, delivery_note, status) values (t, 'Matairi 265/65R17', '48', current_date - 76, 'DN-0301', 'accepted');
  insert into public.invoices (tender_id, invoice_no, invoice_date, amount, paid, paid_on) values (t, 'INV-2026-019', current_date - 72, 25900000, 0, null);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '72 days', 'Invoice imetolewa'), (t, v_user, now() - interval '20 days', 'Tumefuatilia malipo kwa barua');

  -- ---------- 12. Closed: paid in full ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-TRA/G/2026/051', 'Ugavi wa vifaa vya ofisi (stationery)', 'Mamlaka ya Mapato Tanzania (TRA)', 'goods', 'Request for Quotations', 'Dar es Salaam', 'closed',
    current_date - 210, pg_temp.dt(-190), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 14200000, 500000, 300000, 18900000);
  perform pg_temp.docs(t, v_org, 15, array['mfr']);
  insert into public.tender_contracts (tender_id, award_date, award_amount, contract_no, signed_at, contract_value, start_date, end_date)
  values (t, current_date - 170, 18900000, 'TRA/LPO/2026/51', current_date - 165, 18900000, current_date - 164, current_date - 140);
  insert into public.deliveries (tender_id, item, qty, delivery_date, delivery_note, status) values (t, 'Karatasi, faili na kalamu', 'Lot 1', current_date - 145, 'DN-0255', 'accepted');
  insert into public.invoices (tender_id, invoice_no, invoice_date, amount, paid, paid_on) values (t, 'INV-2026-008', current_date - 144, 18900000, 18900000, current_date - 101);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '101 days', 'Malipo yamekamilika'), (t, v_user, now() - interval '100 days', 'Hatua: Imefungwa');

  -- ---------- 13. Closed: delivered late, paid in full ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-NHIF/G/2026/017', 'Ugavi wa viti 300 vya kusubiria', 'Mfuko wa Taifa wa Bima ya Afya (NHIF)', 'goods', 'National Competitive Tendering', 'Dodoma', 'closed',
    current_date - 260, pg_temp.dt(-235), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 39500000, 3500000, 1000000, 52400000);
  perform pg_temp.docs(t, v_org, 15);
  insert into public.tender_contracts (tender_id, award_date, award_amount, contract_no, signed_at, contract_value, start_date, end_date, ps_amount, ps_expiry, ps_submitted)
  values (t, current_date - 205, 52400000, 'NHIF/G/2026/17', current_date - 196, 52400000, current_date - 195, current_date - 165, 5240000, current_date - 60, true);
  insert into public.deliveries (tender_id, item, qty, delivery_date, delivery_note, status) values (t, 'Viti vya kusubiria (seti za 3)', '100', current_date - 158, 'DN-0219', 'accepted');
  insert into public.invoices (tender_id, invoice_no, invoice_date, amount, paid, paid_on) values (t, 'INV-2026-004', current_date - 156, 52400000, 52400000, current_date - 112);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '158 days', 'Delivery imechelewa siku 7'), (t, v_user, now() - interval '110 days', 'Hatua: Imefungwa');

  -- ---------- 14. Lost: our price was higher ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by, notes)
  values (v_org, 'DEMO-TAA/G/2026/029', 'Ugavi wa sare za wafanyakazi', 'Mamlaka ya Viwanja vya Ndege (TAA)', 'goods', 'National Competitive Tendering', 'Dar es Salaam', 'lost',
    current_date - 120, pg_temp.dt(-95), v_user, v_user, 'Mshindi alikuwa chini kwa 9%. Somo: tafuta msambazaji wa vitambaa wa ndani.')
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 27000000, 1000000, 500000, 34800000);
  perform pg_temp.docs(t, v_org, 15);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '95 days', 'Hatua: Imewasilishwa'), (t, v_user, now() - interval '60 days', 'Hatua: Tumepoteza');

  -- ---------- 15. Lost: decided not to bid ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by, notes)
  values (v_org, 'DEMO-PMO/CONS/2026/004', 'Ushauri wa mfumo wa TEHAMA', 'Ofisi ya Waziri Mkuu', 'cons', 'Quality and Cost Based Selection', 'Dodoma', 'lost',
    current_date - 50, pg_temp.dt(-28), v_user, v_user, 'Hatukuomba: inahitaji uzoefu wa miaka 10 wa ushauri.')
  returning id into t;
  perform pg_temp.docs(t, v_org, 2);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '35 days', 'Uamuzi: hatuombi (no-bid)');

  -- ---------- 16. Supply: works, delivery planned ----------
  insert into public.tenders (org_id, tender_no, title, entity, category, method, region, stage, published_at, deadline, lead_user, created_by)
  values (v_org, 'DEMO-RUWASA/W/2026/012', 'Ujenzi wa tanki la maji lita 50,000', 'RUWASA Singida', 'works', 'National Competitive Tendering', 'Singida', 'supply',
    current_date - 140, pg_temp.dt(-115), v_user, v_user)
  returning id into t;
  insert into public.tender_pricing (tender_id, cost, transport, other, bid_price) values (t, 71000000, 6000000, 4000000, 94500000);
  perform pg_temp.docs(t, v_org, 15, array['mfr','literature']);
  insert into public.tender_contracts (tender_id, award_date, award_amount, contract_no, signed_at, contract_value, start_date, end_date, ps_amount, ps_expiry, ps_submitted)
  values (t, current_date - 85, 94500000, 'RUWASA/SGD/W/12', current_date - 75, 94500000, current_date - 70, current_date + 25, 9450000, current_date + 85, true);
  insert into public.deliveries (tender_id, item, qty, delivery_date, delivery_note, status) values
    (t, 'Msingi na kuta (hatua ya 1)', '1', current_date - 20, 'Cheti cha hatua 1', 'delivered'),
    (t, 'Tanki na mabomba (hatua ya 2)', '1', current_date + 20, null, 'planned');
  insert into public.invoices (tender_id, invoice_no, invoice_date, amount, paid, paid_on) values (t, 'INV-2026-040', current_date - 18, 37800000, 0, null);
  insert into public.activity_log (tender_id, user_id, at, text) values (t, v_user, now() - interval '20 days', 'Hatua ya 1 imekamilika'), (t, v_user, now() - interval '18 days', 'Invoice ya hatua 1 imetolewa');

  -- ---------- team: one invitation waiting ----------
  insert into public.invitations (org_id, email, role, invited_by) values (v_org, 'afisa.demo@example.com', 'officer', v_user);

  raise notice 'Demo data added to company %', v_org;
end $$;
