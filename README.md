# domovina-fiskal-app

Customer dashboard za [domovina-fiskal](https://github.com/domovinatv/domovina-fiskal) —
self-service izdavanje HR (fiskaliziranih) računa na `fiskal.domovina.ai/app`.

Korisnik ulazi **pozivnicom** (link `…/app/poziv#<token>` od vlasnika firme ili
administratora servisa), izradi **passkey** i poslije se prijavljuje samo njime.
Ima pristup svojim tenantima s dropdown prebacivanjem.

## Arhitektura

- **Next 14 App Router, `output: "export"`, `basePath: "/app"`** (statički SPA).
  Ne deploya se zasebno: fiskal Worker ga servira kao static assets
  (`backend/wrangler.toml` `[assets]`, `backend/scripts/build-app.sh`).
- **Isti origin kao API.** `lib/fiskal.ts` zove relativni `/api/v1` s
  `credentials: "same-origin"`; sesija je HttpOnly kolačić `__Host-fiskal_app`
  koji postavlja Worker. Nema CORS-a, tokena u `localStorage` ni varijabli okoline.
  Tenant se bira zaglavljem `X-Tenant-Id`.
- **Passkey** (`lib/passkey.ts`, `@simplewebauthn/browser`): opcije i provjera su na
  Workeru (`/api/v1/prijava/*`, `/poziv/*`, `/passkeyi/*`).
- Stranice: prijava (`AuthGate`), `/app/poziv` (token iz `location.hash`, odmah se
  briše iz adrese), `/app/dashboard/passkeyi` (moji passkeyi), `/app/dashboard/clanovi`
  (samo vlasnik: pozivnice za knjigovođu/operatera, deaktivacija).
- Detalj dokumenta koristi `?id=` query param (bez dinamičkih ruta) da statički
  export ostane čist.
- Autorizacija (tko vidi koji tenant, uloge `vlasnik`/`knjigovodja`/`operater`)
  živi u fiskal backendu (`korisnik_tenant`). SPOT: `domovina-fiskal/docs/passkey/`.

## Razvoj

Passkey traži da stranica i API budu na istom originu, pa se app razvija kroz Worker:

```bash
# u domovina-fiskal/backend (FISKAL_APP_DIR pokazuje na ovaj repo, ima zadanu vrijednost)
npm run db:migrate:local
npm run dev:app              # build appa → app-dist/app, pa wrangler dev
# → http://localhost:8787/app/
```

Pozivnicu za lokalni račun izdaje `/admin/korisnici` (ili `POST /admin/korisnici/pozivnica`
s `ADMIN_SKRIPTA_TOKEN`). `npm run dev` (Next na :3000) radi samo za izgled stranica:
`/api/v1` tamo ne postoji.

## Deploy

Ide s backendom: `npm run deploy:test` / `npm run deploy` u `domovina-fiskal/backend`
pozivaju `build:app`, koji builda ovaj repo i kopira `out/` u Worker assets.
