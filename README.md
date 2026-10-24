# CheaperPack.com

A free, source-led guide to keeping phones and other technology useful for longer. CheaperPack
helps people identify device facts, check simple connector fit, troubleshoot common problems and
inspect used devices. The cable finder uses a small, curated data set and manufacturer references;
it does not use a paid API or claim compatibility where a fact has not been verified.

The existing private money-saving calculators remain available under `/tools/` as supporting
decision tools. Their calculations and saved inputs still run in the visitor's browser. The site
has no application server or database. The only third-party script is Google Analytics
(`G-J8LMKCM7YX`).

- **Framework:** [Astro](https://astro.build) 7, every page pre-rendered to static HTML, with Tailwind CSS 4 and plain TypeScript (no UI framework).
- **Hosting:** Cloudflare Workers static assets, live at https://cheaperpack.com. The same build also works on Cloudflare Pages.
- **OCR:** the official [PaddleOCR.js](https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js) SDK with ONNX Runtime Web, running in a Web Worker and loaded only when someone scans.

## Tools

| Tool | Route | What it does |
| --- | --- | --- |
| Smart Price Comparison | `/tools/price-comparison/` | Price per kg / L / piece / oz for 2–8 products. Type “2kg for 210, 1.5kg for 189” or scan a price tag |
| Bulk Buying Calculator | `/tools/bulk-buying-calculator/` | Regular vs bulk pack: savings, break-even amount, waste before expiry |
| BOGO Deal Calculator | `/tools/bogo-calculator/` | Buy X get Y (free or discounted), per-order limits, vs a plain discount |
| Smart Deal Calculator | `/tools/deal-calculator/` | Stacked % / flat discounts, coupons, capped cashback, delivery, buy X get Y |
| Subscription Calculator | `/tools/subscription-calculator/` | Monthly/yearly totals, biggest costs, savings from cancelling, renewals, annual vs monthly |
| EMI vs Cash | `/tools/emi-vs-cash/` | Reducing-balance EMI, fees, cash and no-cost-EMI discounts, effective yearly rate |
| Cost Per Use | `/tools/cost-per-use/` | Price + upkeep − resale, divided by uses, compared across options |
| Electricity Cost | `/tools/electricity-cost/` | kWh and cost per day/month/year per appliance, with standby power |
| Grocery Budget Planner | `/tools/grocery-budget/` | Budget, items, ticking off, saved and reusable lists, copy/CSV/share |
| Receipt Expense Analyzer | `/tools/receipt-analyzer/` | On-device receipt OCR, editable items, categories, spending across receipts |

Shared across the tools:

- **Results as you type**, with clear messages for missing, zero, negative and invalid values.
- **“Show me why”** under each result, showing the arithmetic behind the recommendation.
- **Currency** choice of INR, USD, EUR or GBP, defaulting from the browser language. It's remembered across tools and never converts amounts.
- **Recent calculations** kept in the browser, with delete-one and clear-all.
- **Share links** that carry the inputs in the URL `#fragment`, which browsers don't send to the server. Subscriptions and receipts can't be shared.
- **Phones:** a result bar at the bottom appears while the result is scrolled out of view.
- **Privacy:** the Privacy page deletes everything CheaperPack stored (localStorage and IndexedDB).

## Run it locally

You need **Node.js 22.22 or newer**.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321.

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit tests: unit conversion, parsing, discounts, cashback, BOGO, EMI, electricity, budgets, receipts and OCR text. |
| `npm run build` | Type-checks and builds the static site into `dist/`. |
| `npm run preview` | Builds, then serves `dist/` with Wrangler at http://localhost:8787, with the production headers. Use this to test scanning. |
| `npm run deploy` | Builds and deploys to Cloudflare Workers. |
| `npm run og` | Regenerates `public/og.png` and `public/apple-touch-icon.png`. |
| `npm run ocr:models` | Restores or re-verifies the OCR model files in `src/assets/ocr/` (SHA-256 checked). |

## Project layout

```
src/
  data/devices.ts         Verified device facts, connector records and source URLs
  data/guides.ts          Source-linked repair and second-hand buying guides
  data/tools.ts            Tool registry: names, SEO text, categories, related tools
  layouts/Base.astro       <head> metadata, header, footer
  components/
    layout/                Header, Footer, ToolLayout (breadcrumbs, FAQ, related tools, JSON-LD)
    shared/                Field, Choice, SelectField, UnitSelect, ResultPanel, ToolCard, Icon…
    tools/                 Repeated rows for individual tools (deals, appliances, options)
    tool/                  Smart Price Comparison markup
  lib/
    calculations/          Pure calculation modules + tests (compare, units, deals, bulk, bogo,
                           subscriptions, emi, cost-per-use, electricity, budget, money, validate)
    parsing/               Number parsing, free-text and price-tag parsing, receipt parsing + tests
    formatting/            Currency lists and number formatting
    ocr/                   Shared OCR: client (worker, progress, errors), worker, engine
    storage/               localStorage helpers, history, IndexedDB (receipts), share state
    ui/                    Browser helpers: tool controller, fields, rows, currency, share, render
  scripts/                 Page scripts (price tool, scanner sheet, tools/*)
  pages/                   /, /devices/*, /guides/*, /compatibility/, /tools/*, /faq/, /privacy/, 404
  styles/app.css           White design system (Tailwind theme + shared components)
  assets/ocr/              PP-OCRv6 tiny detection and recognition models (Apache-2.0)
public/                    _headers, robots.txt, icons, og.png, Google verification file
```

Calculation logic never touches the DOM. Every tool page combines `ToolLayout` + `ResultPanel`
with a script that reads fields, calls a calculation module and renders the result through
`lib/ui/tool.ts`.

## OCR notes

- **Lazy loading:** nothing OCR-related loads until someone opens the scanner or picks a receipt photo. Tools that don't scan never load OCR code. The first scan downloads about 13 MB (OpenCV.js, the ONNX Runtime WebAssembly file and 6.3 MB of models). These are served from this site with year-long immutable caching, so later scans start in about a second.
- **Own worker:** OCR runs in our own Web Worker, using the SDK's direct mode with an OpenCV `Mat` as input. The SDK's built-in worker mode would also load OpenCV.js on the page itself. A Vite plugin in `astro.config.mjs` stops the unused 11 MB SDK worker from being emitted.
- **WebAssembly only:** `onnxruntime-web` is aliased to its WebAssembly-only build. The WebGPU runtime is a 28 MB file, over Cloudflare's 25 MiB per-file limit, and isn't reliably faster for these small models on phones. The largest deployed file is 14.2 MB.
- **Headers:** `/tools/*` is cross-origin isolated (COOP/COEP) so OCR can use several CPU threads. OpenCV.js generates code with `new Function`, so `_headers` removes the CSP from `/_astro/*` files only. Pages keep a strict CSP without `unsafe-eval`.
- **Receipts:** text boxes are grouped into printed lines. Lines ending in an amount become items, while totals, tax, discounts and payment lines are kept apart. The page warns when items, tax and discounts don't add up to the printed total. Images are never stored.

## Deploying

The site is deployed as a Cloudflare Worker named `cheaperpack` (static assets only). It's
served at `cheaperpack.com`, `www.cheaperpack.com` and `cheaperpack.cheaperpack.workers.dev`
through the `routes` in `wrangler.jsonc`.

```bash
npx wrangler login
```

```bash
npm run deploy
```

**Cloudflare Pages instead:** the same `dist/` works, including `_headers`. For example:

```bash
npx wrangler pages deploy dist --project-name cheaperpack
```

Use either Workers or Pages for the domain, not both. Moving to Pages means removing the
custom domains from the Worker first.

### Still to do in the Cloudflare and Google dashboards

- **Redirect www to the main domain:** Rules → Redirect Rules → template “Redirect from WWW to root” (301).
- **Google Search Console:** verify (the HTML file is in `public/`, or use a Domain property via DNS), then submit `https://cheaperpack.com/sitemap-index.xml`.

## Ownership content and compatibility data

- **Devices:** add a model in `src/data/devices.ts` only when its displayed facts have a manufacturer source URL. Each static device route is generated from this registry.
- **Guides:** add source-linked repair or buying content in `src/data/guides.ts`. Keep advice reversible and cite the manufacturer or other primary reference used.
- **Compatibility:** `src/pages/compatibility.astro` currently answers only whether a cable's phone-end plug matches the charging port. It does not claim speed, data capability, product quality or case/part fit. Unknown models remain unknown until sourced data is added.

## Things to know when changing the site

- **Adding a tool:** add it to `src/data/tools.ts` (the homepage, hub, footer and related links update automatically), put the maths in `src/lib/calculations/` with a test, and build the page with `ToolLayout` and `ResultPanel`.
- **Analytics:** Google Analytics 4 is set up in `src/scripts/analytics.ts` and loaded from `Base.astro`. It sends the page address without the `#fragment`, so share-link values never reach Google. Its domains are allowed in the CSP in `public/_headers`. If you change analytics, update `src/pages/privacy.astro` to match. Visitors in the EU/UK normally need to consent before analytics cookies are set; there is no consent banner yet.
- **Units:** to add a unit, add it to `UNITS` in `src/lib/calculations/units.ts` with its exact size in g, ml or items, and to `TOOL_UNITS` in `src/lib/storage/tool-state.ts`.
