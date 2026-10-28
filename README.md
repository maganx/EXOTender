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
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
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
```
