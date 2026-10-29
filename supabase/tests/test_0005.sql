-- run after 0005_tighten.sql on the test database built by the earlier tests
\set ON_ERROR_STOP 0
reset role;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000e1','o1@five.tz'),('00000000-0000-0000-0000-0000000000e2','o2@five.tz'),
 ('00000000-0000-0000-0000-0000000000e3','ad@five.tz'),('00000000-0000-0000-0000-0000000000e4','v@five.tz'),
 ('00000000-0000-0000-0000-0000000000e5','x@five.tz');
set role authenticated;
select as_user('00000000-0000-0000-0000-0000000000e1');
select public.create_organization('Five Ltd') as five \gset
insert into invitations(org_id,email,role) values (:'five','o2@five.tz','admin') returning token as t2 \gset
insert into invitations(org_id,email,role) values (:'five','ad@five.tz','admin') returning token as t3 \gset
insert into invitations(org_id,email,role) values (:'five','v@five.tz','viewer') returning token as t4 \gset
select as_user('00000000-0000-0000-0000-0000000000e2'); select accept_invitation(:'t2');
select as_user('00000000-0000-0000-0000-0000000000e3'); select accept_invitation(:'t3');
select as_user('00000000-0000-0000-0000-0000000000e4'); select accept_invitation(:'t4');
select as_user('00000000-0000-0000-0000-0000000000e1');
update memberships set role='owner' where org_id=:'five' and user_id='00000000-0000-0000-0000-0000000000e2';
-- admin may not remove an owner (expect ERROR only an owner can change owners)
select as_user('00000000-0000-0000-0000-0000000000e3');
delete from memberships where org_id=:'five' and user_id='00000000-0000-0000-0000-0000000000e2';
-- admin may not add someone directly (expect ERROR row-level security)
insert into memberships(org_id,user_id,role) values (:'five','00000000-0000-0000-0000-0000000000e5','viewer');
-- admin removes the viewer: allowed
delete from memberships where org_id=:'five' and user_id='00000000-0000-0000-0000-0000000000e4';
-- an owner leaves while another owner stays: allowed
select as_user('00000000-0000-0000-0000-0000000000e2');
delete from memberships where org_id=:'five' and user_id='00000000-0000-0000-0000-0000000000e2';
reset role;
select 'members left (expect 2)', count(*) from memberships where org_id=:'five';
-- deleting the last owner's account in Supabase Auth works
delete from auth.users where id='00000000-0000-0000-0000-0000000000e1';
select 'members after user delete (expect 1)', count(*) from memberships where org_id=:'five';
-- deleting the company works
delete from organizations where id=:'five';
select 'company gone (expect 0)', count(*) from organizations where id=:'five';
