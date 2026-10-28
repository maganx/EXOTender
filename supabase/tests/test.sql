\set ON_ERROR_STOP 0
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','a@exo.tz'),('00000000-0000-0000-0000-00000000000b','b@exo.tz'),
 ('00000000-0000-0000-0000-00000000000c','c@other.tz'),('00000000-0000-0000-0000-00000000000d','d@exo.tz');
create or replace function as_user(u text) returns void language plpgsql security definer as $$ begin
 perform set_config('request.jwt.claim.sub', u, false);
 perform set_config('request.jwt.claims', json_build_object('sub',u,'email',(select email from auth.users where id=u::uuid))::text, false); end $$;
grant execute on function as_user(text) to authenticated;
set role authenticated;
select as_user('00000000-0000-0000-0000-00000000000a');
select public.create_organization('EXO Global') as exo \gset
insert into invitations(org_id,email,role) values (:'exo','b@exo.tz','viewer') returning token as tok \gset
insert into invitations(org_id,email,role) values (:'exo','d@exo.tz','finance') returning token as tokd \gset
insert into tenders(org_id,tender_no,title) values (:'exo','T/1','ICT supply') returning id as t1 \gset
insert into tender_pricing(tender_id,cost,bid_price) values (:'t1',100,150);
insert into invoices(tender_id,amount) values (:'t1',150);
insert into storage.objects(bucket_id,name) values ('company-docs', :'exo' || '/brela.pdf');
select 'A sees tenders', count(*) from tenders;
-- viewer B
select as_user('00000000-0000-0000-0000-00000000000b');
select 'B before accept', count(*) from tenders;
select public.accept_invitation(:'tok');
select 'B tenders', count(*) from tenders;
select 'B pricing (expect 0)', count(*) from tender_pricing;
select 'B invoices (expect 0)', count(*) from invoices;
update tenders set title='hack' where id=:'t1';
select 'B title unchanged', title from tenders;
insert into memberships(org_id,user_id,role) values (:'exo','00000000-0000-0000-0000-00000000000b','admin');
update memberships set role='admin' where user_id='00000000-0000-0000-0000-00000000000b';
select 'B role still', role from memberships where user_id='00000000-0000-0000-0000-00000000000b';
-- finance D
select as_user('00000000-0000-0000-0000-00000000000d');
select public.accept_invitation(:'tokd');
select 'D invoices', count(*) from invoices; update invoices set paid=150; select 'D paid', paid from invoices;
update tenders set title='x'; select 'D title', title from tenders;
-- other company C
select as_user('00000000-0000-0000-0000-00000000000c');
select public.create_organization('Other Ltd') as oth \gset
select 'C sees EXO tenders (expect 0)', count(*) from tenders;
select 'C sees EXO org (expect 1 own)', count(*) from organizations;
select 'C storage (expect 0)', count(*) from storage.objects;
insert into tenders(org_id,tender_no,title) values (:'exo','X','inject');
select public.accept_invitation(:'tok');
insert into memberships(org_id,user_id,role) values (:'exo','00000000-0000-0000-0000-00000000000c','owner');
-- owner A tries to demote self as only owner
select as_user('00000000-0000-0000-0000-00000000000a');
update memberships set role='admin' where user_id='00000000-0000-0000-0000-00000000000a';
select 'A storage', count(*) from storage.objects;
