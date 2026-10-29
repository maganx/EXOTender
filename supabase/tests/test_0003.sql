-- run after test_0002.sql
\set ON_ERROR_STOP 0
reset role;
select id as exo from organizations where name like 'EXO Global%' \gset
set role authenticated;
-- owner A inserts a selcom payment and tries to fake the gateway fields
select as_user('00000000-0000-0000-0000-00000000000a');
insert into payments(org_id,plan_id,months,amount_tzs,method,reference,order_id,gateway_transid,submitted_by)
 values (:'exo','month',1,0,'selcom','TDORDER1','TDORDER1','FAKE','00000000-0000-0000-0000-00000000000a');
select 'A selcom row: transid null, amount 50000', gateway_transid, amount_tzs, status from payments where order_id='TDORDER1';
select set_gateway_key(repeat('a',64));
select 'A sees no secrets'; select * from platform_secrets;
select public.gateway_confirm_payment('TDORDER1','T1',50000,'guess');
select 'A row still pending', status from payments where order_id='TDORDER1';
update organizations set paid_until = now() + interval '5 years' where id=:'exo';
-- platform admin stores the hash of the server key
select as_user('00000000-0000-0000-0000-0000000000ff');
select set_gateway_key(encode(sha256(convert_to('server-key','UTF8')),'hex'));
select 'ready', gateway_ready();
reset role;
select paid_until as before from organizations where id=:'exo' \gset
-- the webhook runs as anon with the right key
set role anon;
select set_config('request.jwt.claim.sub','',false);
select 'short amount', public.gateway_confirm_payment('TDORDER1','T1',100,'server-key');
select 'confirm', public.gateway_confirm_payment('TDORDER1','T1',50000,'server-key');
select 'again (idempotent)', public.gateway_confirm_payment('TDORDER1','T1',50000,'server-key');
select 'unknown', public.gateway_confirm_payment('NOPE','T1',50000,'server-key');
reset role;
select 'approved + 1 month', status, gateway_transid, note from payments where order_id='TDORDER1';
select 'paid_until moved by ~1 month', (paid_until - :'before'::timestamptz) from organizations where id=:'exo';
select 'guard back on', current_setting('tenda.gateway', true);
-- closing an abandoned checkout
set role authenticated;
select as_user('00000000-0000-0000-0000-00000000000a');
insert into payments(org_id,plan_id,months,amount_tzs,method,reference,order_id,submitted_by)
 values (:'exo','year',1,0,'selcom','TDORDER2','TDORDER2','00000000-0000-0000-0000-00000000000a');
set role anon;
select public.gateway_close_payment('TDORDER2','USERCANCELLED','server-key');
reset role;
select 'closed', status, note from payments where order_id='TDORDER2';
