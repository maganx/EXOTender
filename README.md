# Tenda Desk

Mfumo wa kusimamia tenda za serikali (NeST) kwa makampuni mengi: kutoka tenda kuonekana, maandalizi ya nyaraka, bei, tuzo, mkataba, usambazaji hadi malipo.

Multi-company tender management for Tanzanian government tenders (NeST), built with Next.js 16 and Supabase, hosted on Cloudflare Workers via OpenNext.

## Nini kimo / What's inside

- Login kwa barua pepe na neno la siri (Supabase Auth)
- Makampuni mengi: kila kampuni inaona data yake tu (Row Level Security kwenye database)
- Majukumu: Mmiliki, Msimamizi, Afisa wa tenda, Fedha, Msomaji
  - Msomaji haoni bei wala malipo; Fedha anarekodi ankara na malipo; Afisa anasimamia tenda
- Tenda: taarifa, orodha ya nyaraka na kipengele chake, bei na faida, tuzo na mkataba, performance security, usambazaji (DN/GRN), ankara na malipo, kumbukumbu
- Nyaraka za kampuni (BRELA, TIN, Tax clearance...) zinahifadhiwa mara moja pamoja na tarehe ya kuisha
- Kiswahili / English

## Kuweka hewani / Deploy

1. **Database (Supabase):** Supabase dashboard → SQL Editor → bandika yaliyomo kwenye `supabase/migrations/0001_init.sql` → Run. Kisha fanya hivyo hivyo kwa `supabase/migrations/0002_files_billing.sql` (faili za tenda, usomaji wa Claude, vifurushi na malipo).
2. **Auth:** Supabase → Authentication → URL Configuration → weka `Site URL` kuwa anwani ya tovuti (mfano `https://tenda-desk.netlify.app`) na ongeza `https://<anwani>/auth/callback` kwenye Redirect URLs.
3. **Hosting (Cloudflare Workers):** Cloudflare dashboard → Workers & Pages → Create → Import a repository → chagua repository hii, kisha:
   - Settings → Builds → tab **Production**: branch `main`, Build command `npx opennextjs-cloudflare build`, Deploy command `npx wrangler deploy`
   - Tab **Previews Base** (matawi ya PR): Build command `npx opennextjs-cloudflare build`, Deploy command `npx wrangler preview` (inahitaji `"previews": {}` kwenye `wrangler.jsonc`, tayari ipo)
   - Push kwenye `main` ikijengwa kama Preview (link ya build ina `/previews/main/`) au isijengwe kabisa, hakikisha **Production branch** ni `main` na umebonyeza Save; kisha push inayofuata kwenye `main` itaenda hewani.
   - Build variables / Variables and secrets (zote mbili, build na runtime):
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://hyizioycuwifddtrzbri.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase → Project Settings → API → `anon public` key
     - `NEXT_PUBLIC_SITE_URL` = anwani ya tovuti (mfano `https://exotender.<account>.workers.dev`)

   `wrangler.jsonc` na `open-next.config.ts` tayari zimewekwa. Kujaribu kwenye kompyuta: `npm run preview`.

4. Fungua tovuti, bonyeza **Fungua akaunti**, thibitisha barua pepe, kisha sajili kampuni yako. Wewe utakuwa Mmiliki.

Usiweke `service_role` key kwenye hosting wala kwenye code: programu haihitaji.

## Usomaji wa Claude / Tender document reader

Weka `ANTHROPIC_API_KEY` (kutoka console.anthropic.com → API Keys) kama **Secret** kwenye Cloudflare: Worker → Settings → Variables and Secrets. Si build variable. Kikomo cha usomaji kwa kampuni kwa mwezi ni `AI_MONTHLY_READS` (30 kama haijawekwa). PDF inasomwa kwenye browser (pdf.js), maandishi tu ndiyo yanatumwa kwa Claude.

## Usajili na malipo / Subscriptions

- Kila kampuni mpya inapata siku 14 za majaribio. Muda ukiisha, kurasa zote zinapeleka kwenye **Malipo** hadi walipie.
- Kampuni inalipa kwa simu au benki, kisha inaweka namba ya muamala kwenye ukurasa wa Malipo.
- Msimamizi wa mfumo anathibitisha kwenye **Usimamizi** (`/app/admin`), na usajili unaongezwa kulingana na kifurushi.
- Kujifanya msimamizi wa mfumo, endesha kwenye SQL Editor (badilisha barua pepe):
  `insert into platform_admins (user_id) select id from auth.users where email = 'barua@pepe.yako';`
- Bei ziko kwenye jedwali `plans` (TZS). Unaweza kuzibadilisha kwenye Supabase → Table Editor → plans.

### Selcom (malipo ya moja kwa moja)

1. Endesha `supabase/migrations/0003_selcom.sql` kwenye SQL Editor.
2. Kutoka Selcom (akaunti ya mfanyabiashara, Checkout API) weka hizi kama **Secrets** kwenye Cloudflare Worker: `SELCOM_API_KEY`, `SELCOM_API_SECRET`, `SELCOM_VENDOR` (namba ya till/vendor). `SELCOM_BASE_URL` ni hiari (chaguo-msingi `https://apigw.selcommobile.com`; weka anwani ya sandbox wakati wa majaribio).
3. Fungua **Usimamizi** na ubofye **Washa Selcom**. Hii inahifadhi alama ya ufunguo kwenye database na kujaribu funguo kwa Selcom.
4. Mpe Selcom anwani ya webhook inayoonyeshwa hapo (`/api/selcom/webhook`) kama wataiomba.

Kampuni inachagua kifurushi na kuweka namba ya simu; inapokea ombi la PIN. Webhook ya Selcom haina sahihi, kwa hiyo seva inauliza Selcom hali ya oda yenyewe kabla ya kuongeza usajili. Malipo ya mkono yanaendelea kufanya kazi pembeni.

## Mialiko na email / Invitations and email

- Endesha `supabase/migrations/0004_invites_email.sql`. Ukurasa wa mwaliko unaonyesha kampuni, nafasi na barua pepe ya mwaliko, na unamwongoza mhusika kujisajili au kuingia kwa barua pepe hiyo.
- Kila mwaliko una kitufe cha **Tuma WhatsApp**. Email inatumwa yenyewe pale tu huduma ya email imewekwa.
- **Email za mfumo (mialiko):** fungua akaunti ya [Resend](https://resend.com), thibitisha domain yako (mf. `exoglobal.co.tz`), kisha weka Secrets kwenye Cloudflare Worker: `RESEND_API_KEY` na `EMAIL_FROM` (mf. `Tenda Desk <tenda@exoglobal.co.tz>`).
- **Email za akaunti (Supabase):** Supabase → Authentication → Emails → SMTP Settings: host `smtp.resend.com`, port `465`, user `resend`, password = API key ya Resend, sender = anwani ile ile. Kisha Templates: bandika HTML kutoka `supabase/email-templates/` (confirm-signup, reset-password, magic-link, change-email, invite-user). Kuzitengeneza upya: `node --experimental-strip-types scripts/email-templates.mjs`.
- Supabase → Authentication → URL Configuration: Site URL = anwani ya tovuti, na Redirect URLs iwe na `https://<tovuti>/**`.
- Link za email zinatumia `token_hash`, kwa hiyo zinafunguka kwenye simu au kompyuta yoyote, si lazima ile aliyojisajilia.

## Usalama wa ziada / Tightening (0005)

Endesha `supabase/migrations/0005_tighten.sql`. Inahakikisha:
- Msimamizi (admin) hawezi kumwondoa mmiliki; mmiliki pekee ndiye anaweza.
- Mtu anaingia kampuni kwa kukubali mwaliko tu, si kwa kuongezwa moja kwa moja.
- Kufuta mtumiaji kwenye Supabase Auth, au kufuta kampuni, hakuzuiliwi tena na sheria ya "mmiliki mmoja".
- Rekodi za faili zinabaki ndani ya folda ya kampuni na tenda yake.

## Kuendesha kwenye kompyuta / Local

```bash
cp .env.example .env.local   # jaza anon key
npm install
npm run dev
```

## Majaribio ya database / Database tests

`supabase/tests/` ina majaribio yanayothibitisha kwamba kampuni moja haioni data ya nyingine na kwamba roles zinafanya kazi (PostgreSQL 16):

```bash
psql -d test -f supabase/tests/stub.sql
psql -d test -f supabase/migrations/0001_init.sql
psql -d test -f supabase/tests/grants.sql
psql -d test -f supabase/tests/test.sql
psql -d test -f supabase/migrations/0002_files_billing.sql
psql -d test -f supabase/tests/test_0002.sql
psql -d test -f supabase/migrations/0003_selcom.sql
psql -d test -f supabase/tests/test_0003.sql
psql -d test -f supabase/migrations/0004_invites_email.sql
psql -d test -f supabase/migrations/0005_tighten.sql
psql -d test -f supabase/tests/test_0005.sql
```
