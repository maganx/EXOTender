-- run after test.sql (reuses its users and companies)
\set ON_ERROR_STOP 0
reset role;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000ff','admin@tendadesk.tz');
insert into platform_admins(user_id) values ('00000000-0000-0000-0000-0000000000ff');
select id as exo from organizations where name='EXO Global' \gset
select id as oth from organizations where name='Other Ltd' \gset
select id as t1 from tenders where tender_no='T/1' \gset
set role authenticated;

-- owner A: files and payments
select as_user('00000000-0000-0000-0000-00000000000a');
insert into tender_files(org_id,tender_id,kind,title,storage_path) values (:'exo',:'t1','tender','SBD', :'exo' || '/tenders/' || :'t1' || '/x-sbd.pdf');
select 'A file ok', count(*) from tender_files;
insert into tender_files(org_id,tender_id,kind,title,storage_path) values (:'exo',:'t1','bid','bad path', :'oth' || '/tenders/' || :'t1' || '/y.pdf');
update organizations set paid_until = now() + interval '5 years' where id=:'exo';
select 'A paid_until still null', paid_until from organizations where id=:'exo';
update organizations set name='EXO Global Co' where id=:'exo';
select 'A can rename', name from organizations where id=:'exo';
insert into payments(org_id,plan_id,months,amount_tzs,method,reference,submitted_by) values (:'exo','year',99,1,'mpesa','ABC123','00000000-0000-0000-0000-00000000000a') returning id as pay \gset
select 'A payment price from plan (480000, 12)', amount_tzs, months from payments;
update payments set status='approved';
select 'A payment still pending', status from payments;
select public.review_payment(:'pay', true);
-- viewer B cannot see payments or upload
select as_user('00000000-0000-0000-0000-00000000000b');
select 'B payments (expect 0)', count(*) from payments;
select 'B files (expect 1)', count(*) from tender_files;
insert into tender_files(org_id,tender_id,kind,title,storage_path) values (:'exo',:'t1','bid','b', :'exo' || '/tenders/' || :'t1' || '/b.pdf');
-- other company C sees nothing of EXO
select as_user('00000000-0000-0000-0000-00000000000c');
select 'C files (expect 0)', count(*) from tender_files;
select 'C payments (expect 0)', count(*) from payments;
select 'C companies list (expect 0)', count(*) from platform_companies();
-- platform admin approves
select as_user('00000000-0000-0000-0000-0000000000ff');
select 'admin companies (expect 2)', count(*) from platform_companies();
select public.review_payment(:'pay', true, 'ok');
select 'EXO paid ~ 12 months after trial', plan, (paid_until > trial_ends_at + interval '11 months') from organizations where id=:'exo';
select public.review_payment(:'pay', true);
select public.extend_subscription(:'oth', 30);
select 'Other extended', paid_until > now() + interval '40 days' from organizations where id=:'oth';
