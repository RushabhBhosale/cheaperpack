# Recall Radar (working name)

A self-updating tracker of US recalls in three sections, built on public government data. It runs
entirely on Cloudflare (a Worker plus a D1 database) and needs no manual upkeep once deployed.

| Section | Source | Scope | Update job (twice a day) |
| --- | --- | --- | --- |
| Product recalls (`/recalls/`, `/category/`, `/brand/`, `/hazard/`) | [CPSC](https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information) | ~10,000 recalls since 1973 | `src/sync.ts`, by publish date |
| Car recalls (`/cars/…`) | [NHTSA](https://api.nhtsa.gov) flat file and API | Passenger-vehicle campaigns since 2013, ~5,200 | `src/cars/sync.ts`, probes the next campaign numbers |
| Food recalls (`/food/…`) | [openFDA](https://open.fda.gov) enforcement reports | FDA-regulated food since 2019, ~3,700 events | `src/food/sync.ts`, last three weeks of reports |

Meat, poultry and egg recalls (USDA FSIS) are not included: its API blocks automated access.
- **Pages:** rendered on the edge from D1 and cached. No client-side JavaScript, one inline stylesheet, no web fonts.

## What the site contains

| Route | What it is |
| --- | --- |
| `/` | Search, latest recalls, categories, hazards, brands, FAQ |
| `/recall/<number>-<slug>/` | One page per recall: summary, what to do, affected products, photos, where sold, history, FAQ, related recalls |
| `/category/<slug>/`, `/hazard/<slug>/`, `/brand/<slug>/` | Hubs with counts, common hazards, FAQ and paginated lists |
| `/recalls/`, `/browse/`, `/brands/`, `/search/` | Archives and search (search is `noindex`) |
| `/cars/`, `/cars/<make>/`, `/cars/<make>/<model>/<year>/`, `/cars/recall/<campaign>/` | Car recalls by make, model and year, plus one page per NHTSA campaign |
| `/food/`, `/food/recall/<event>/`, `/food/hazard|category|firm/<slug>/` | Food recall events with lot codes, risk class and hubs |
| `/guides/…` | Three evergreen guides sourced from CPSC pages |
| `/about/ /privacy/ /terms/ /contact/` | Pages AdSense and users expect |
| `/sitemap.xml` (index of `sitemap-recalls.xml`, `sitemap-cars.xml`, `sitemap-food.xml`), `/robots.txt`, `/feed.xml`, `/ads.txt` | Generated; `ads.txt` appears once `ADSENSE_PUB_ID` is set |

## SEO design

- **Quality gate** (`src/derive.ts`): a recall is indexable only if it is from 2019 or later and has a full description, hazard, remedy, product, units, sellers and images (quality score ≥ 70). Everything else is served with `noindex,follow` and left out of the sitemap.
- **Drip indexing** (`src/seo.ts`): the backlog enters the index gradually (product recalls 150 + 40 a day, cars 200 + 100 a day, food 100 + 40 a day). Ranks never change, so a page is never switched back to `noindex`. Recalls published after launch are always indexable.
- **Hubs** (categories, hazards, brands with 3+ recalls) are the pages that add something beyond CPSC's own site. Recall pages carry structured facts, FAQ, history and related links, and none is under 350 words.
- Canonical URLs, trailing-slash redirects, breadcrumbs, Article, FAQPage, ItemList and WebSite JSON-LD, RSS feed, IndexNow pings, `lastmod` in the sitemap.

## AdSense readiness

Layout reserves fixed-height ad containers so ads never shift the page. Nothing loads until you configure it.

1. Apply at adsense.google.com once the site has traffic. Pages for privacy, terms, about and contact already exist; set `CONTACT_EMAIL` first.
2. Set `ADSENSE_PUB_ID` (for example `ca-pub-1234567890123456`) in `wrangler.jsonc` and deploy. That loads the AdSense script and serves `/ads.txt`.
3. Optional: set `ADSENSE_SLOT` to turn on the manual in-content slots. Leave it empty to use Auto ads only.
4. In the AdSense dashboard, enable Google's consent message for EEA, UK and Swiss visitors.

## Develop

```bash
npm install
npm run db:local        # create the local D1 tables
npm run backfill:local        # CPSC history (about a minute)
npm run backfill:cars:local   # NHTSA flat file (about two minutes)
npm run backfill:food:local   # openFDA reports (about two minutes)
npm run dev             # http://localhost:8787
npm test && npm run check
```

Test the daily job locally with `npx wrangler dev --test-scheduled` and open `/__scheduled?cron=x`.

## Deploy

```bash
npx wrangler d1 create recalls          # put the printed id into wrangler.jsonc
npx wrangler d1 migrations apply recalls --remote
npm run backfill:remote                 # run once each:
npm run backfill:cars:remote
npm run backfill:food:remote
# set SITE_URL, SITE_NAME, LAUNCH_DATE and CONTACT_EMAIL in wrangler.jsonc, then:
npm run deploy
```

Attach the domain in the Cloudflare dashboard (Workers → recall-tracker → Settings → Domains) or add a
`routes` entry with `custom_domain: true`. Then submit `https://<your-domain>/sitemap.xml` in Google Search Console.

## Limits worth knowing

- Runs on Cloudflare's free plan: the daily sync handles a few dozen records, well inside the free CPU limit. The one-off backfill runs from your computer, not the Worker.
- Recall pages compete with cpsc.gov for the same names, so expect hubs (categories, brands, hazards) and long-tail searches to bring most traffic.
- CPSC's terms: recall notices and photos may be copied; do not imply CPSC endorsement; credit CPSC. NHTSA says site information is public and may be copied. openFDA data is CC0 and attribution is requested. The site credits all three and states it is independent.
- The openFDA daily sync works without a key but shares an IP limit; add a free key as the `OPENFDA_KEY` secret (`npx wrangler secret put OPENFDA_KEY`) if runs ever fail with 429.
