# Tenda Desk

Mfumo wa kusimamia tenda za serikali (NeST) kwa makampuni mengi: kutoka tenda kuonekana, maandalizi ya nyaraka, bei, tuzo, mkataba, usambazaji hadi malipo.

Multi-company tender management for Tanzanian government tenders (NeST), built with Next.js 14 and Supabase.

## Nini kimo / What's inside

- Login kwa barua pepe na neno la siri (Supabase Auth)
- Makampuni mengi: kila kampuni inaona data yake tu (Row Level Security kwenye database)
- Majukumu: Mmiliki, Msimamizi, Afisa wa tenda, Fedha, Msomaji
  - Msomaji haoni bei wala malipo; Fedha anarekodi ankara na malipo; Afisa anasimamia tenda
- Tenda: taarifa, orodha ya nyaraka na kipengele chake, bei na faida, tuzo na mkataba, performance security, usambazaji (DN/GRN), ankara na malipo, kumbukumbu
- Nyaraka za kampuni (BRELA, TIN, Tax clearance...) zinahifadhiwa mara moja pamoja na tarehe ya kuisha
- Kiswahili / English

## Kuweka hewani / Deploy

1. **Database (Supabase):** Supabase dashboard → SQL Editor → bandika yaliyomo kwenye `supabase/migrations/0001_init.sql` → Run.
2. **Auth:** Supabase → Authentication → URL Configuration → weka `Site URL` kuwa anwani ya tovuti (mfano `https://tenda-desk.netlify.app`) na ongeza `https://<anwani>/auth/callback` kwenye Redirect URLs.
3. **Hosting (Netlify au Vercel):** import repository hii kutoka GitHub, kisha weka environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://hyizioycuwifddtrzbri.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase → Project Settings → API → `anon public` key
   - `NEXT_PUBLIC_SITE_URL` = anwani ya tovuti

   Build command `npm run build`. Kwenye Netlify, plugin ya Next.js inawekwa yenyewe.
4. Fungua tovuti, bonyeza **Fungua akaunti**, thibitisha barua pepe, kisha sajili kampuni yako. Wewe utakuwa Mmiliki.

Usiweke `service_role` key kwenye hosting wala kwenye code: programu haihitaji.

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
```
