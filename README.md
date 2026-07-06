# domovina-fiskal-app

Customer dashboard za [domovina-fiskal](https://github.com/domovinatv/domovina-fiskal) —
self-service izdavanje HR (fiskaliziranih) računa na `fiskal.domovina.ai`.

Korisnik se prijavi **jednom** dijeljenim Domovina računom (self-hostani
Supabase/GoTrue na `api.domovina.ai` — isti identitet kao `domovina.ai` i
`pinka.io`) i dobije pristup svojim tenantima s **dropdown prebacivanjem**.

## Arhitektura

- **Next 14 App Router, `output: "export"`** (statički SPA) → Cloudflare Pages.
  Obrazac = `pinka-finance/app`.
- **Supabase je ovdje ISKLJUČIVO prijava/sesija** — podaci su u D1 iza fiskal
  Workera; dashboard zove `fiskal.domovina.ai/api/v1` s korisnikovim JWT-om +
  `X-Tenant-Id` (`lib/fiskal.ts`). Nema čitanja kroz RLS.
- Detalj dokumenta koristi `?id=` query param (bez dinamičkih SSR ruta) da
  statički export ostane čist.
- Autorizacija (tko vidi koji tenant, uloge `vlasnik`/`knjigovodja`/`operater`)
  živi u fiskal backendu (`korisnik_tenant`); pristup dodjeljuje superuser u
  fiskal `/admin`. SPOT: `domovina-fiskal/docs/knowledge/16-dashboard-sso.md`.

## Razvoj

```bash
cp .env.example .env.local   # popuni NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:3000
```

Za lokalni fiskal backend postavi `NEXT_PUBLIC_FISKAL_API_URL=http://localhost:8787/api/v1`
(worker: `domovina-fiskal/backend`, `npx wrangler dev --port 8787`).

## Deploy (Cloudflare Pages)

```bash
npm run build                # → out/
npx wrangler pages deploy out --project-name domovina-fiskal-app
```

⚠️ Dashboard domena mora biti u `ADDITIONAL_REDIRECT_URLS` GoTrue-a
(`domovina-api`, Coolify env) i u `DASHBOARD_ORIGIN` fiskal Workera (CORS).
