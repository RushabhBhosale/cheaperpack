import { getGuide, guidePage, guidesIndex, sitemapStaticPaths, staticPage } from './content.ts';
import { countCards, getRecallByNumber, groupBy, indexableRows, listCards, filters } from './db.ts';
import { HAZARDS } from './derive.ts';
import { esc } from './html.ts';
import { layout } from './layout.ts';
import * as pages from './pages.ts';
import { indexBudget, isIndexable } from './seo.ts';
import { pingIndexNow, syncRecalls } from './sync.ts';
import type { Env } from './types.ts';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Language': 'en',
};

const htmlHeaders = (maxAge: number, sMaxAge: number): Record<string, string> => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=86400`,
  ...SECURITY_HEADERS,
});

const xml = (body: string, type: string, sMaxAge = 3600) =>
  new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': `public, max-age=600, s-maxage=${sMaxAge}`, ...SECURITY_HEADERS } });

const redirect = (to: string, code = 301) => new Response(null, { status: code, headers: { Location: to, 'Cache-Control': 'public, max-age=3600' } });

const MIN_HUB = 8;
const MIN_BRAND = 3;

async function sitemap(env: Env): Promise<Response> {
  const budget = indexBudget(env);
  const [rows, cats, brands] = await Promise.all([indexableRows(env.DB, budget), groupBy(env.DB, 'category', MIN_HUB), groupBy(env.DB, 'brand_slug', MIN_BRAND)]);
  const latest = await listCards(env.DB, filters.all(), 1, 0);
  const today = new Date().toISOString().slice(0, 10);
  const url = (path: string, lastmod?: string) => `<url><loc>${esc(env.SITE_URL + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
  const out: string[] = [];
  for (const p of sitemapStaticPaths) out.push(url(p, p === '/' || p === '/recalls/' ? (latest[0]?.date ?? today) : undefined));
  for (const c of cats) out.push(url(`/category/${c.key}/`, c.latest));
  for (const h of HAZARDS) {
    const n = await countCards(env.DB, { where: 'hazards LIKE ? AND eligible = 1', params: [`%|${h.slug}|%`] });
    if (n >= MIN_HUB) out.push(url(`/hazard/${h.slug}/`, latest[0]?.date ?? today));
  }
  for (const b of brands) if (b.name) out.push(url(`/brand/${b.key}/`, b.latest));
  for (const r of rows) out.push(url(`/recall/${r.slug}/`, r.last_publish));
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${out.join('')}</urlset>`, 'application/xml');
}

async function feed(env: Env): Promise<Response> {
  const cards = await listCards(env.DB, filters.all(), 40, 0);
  const items = cards
    .map((c) => `<item><title>${esc(c.short_title)}</title><link>${esc(`${env.SITE_URL}/recall/${c.slug}/`)}</link><guid isPermaLink="true">${esc(`${env.SITE_URL}/recall/${c.slug}/`)}</guid><pubDate>${new Date(`${c.date}T12:00:00Z`).toUTCString()}</pubDate><description>${esc(c.snippet)}</description></item>`)
    .join('');
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(env.SITE_NAME)}: latest product recalls</title><link>${esc(env.SITE_URL)}/</link><description>The latest US consumer product recalls from CPSC.</description><language>en-us</language>${items}</channel></rss>`, 'application/rss+xml', 900);
}

const robots = (env: Env) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /search/\n\nSitemap: ${env.SITE_URL}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ...SECURITY_HEADERS } });

function adsTxt(env: Env): Response {
  if (!env.ADSENSE_PUB_ID) return new Response('Not found', { status: 404 });
  const pub = env.ADSENSE_PUB_ID.replace(/^ca-/, '');
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

function render(env: Env, page: pages.Page, ttl: { max: number; s: number } = { max: 300, s: 3600 }): Response {
  const status = page.status ?? 200;
  const headers = status === 200 ? htmlHeaders(ttl.max, ttl.s) : { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS };
  return new Response(layout(env, page.meta, page.body), { status, headers });
}

const parsePage = (s: string | undefined): number | null => {
  if (s === undefined) return 1;
  return /^\d{1,4}$/.test(s) && Number(s) >= 2 ? Number(s) : null;
};

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Canonical form: lowercase-free paths end with a slash (files with an extension are exempt).
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) return redirect(`${path}/${url.search}`);
  const seg = path.split('/').filter(Boolean);

  if (path === '/sitemap.xml') return sitemap(env);
  if (path === '/robots.txt') return robots(env);
  if (path === '/feed.xml') return feed(env);
  if (path === '/ads.txt') return adsTxt(env);
  if (env.INDEXNOW_KEY && path === `/${env.INDEXNOW_KEY}.txt`) return new Response(env.INDEXNOW_KEY, { headers: { 'Content-Type': 'text/plain' } });

  if (seg.length === 0) return render(env, await pages.homePage(env), { max: 300, s: 900 });

  switch (seg[0]) {
    case 'recalls': {
      if (seg.length === 1) return render(env, await pages.recallsIndex(env, 1), { max: 300, s: 900 });
      if (seg[1] === 'page' && seg.length === 3) {
        const n = parsePage(seg[2]);
        if (n && n >= 2) return render(env, await pages.recallsIndex(env, n), { max: 300, s: 900 });
      }
      break;
    }
    case 'recall': {
      if (seg.length !== 2) break;
      const slug = seg[1]!;
      const number = slug.split('-')[0]!;
      const recall = await getRecallByNumber(env.DB, number);
      if (!recall) break;
      if (recall.slug !== slug) return redirect(`/recall/${recall.slug}/`);
      return render(env, await pages.recallPage(env, recall), { max: 600, s: 21600 });
    }
    case 'category':
    case 'hazard':
    case 'brand': {
      if (seg.length !== 2 && !(seg.length === 4 && seg[2] === 'page')) break;
      const n = seg.length === 4 ? parsePage(seg[3]) : 1;
      if (!n) break;
      const fn = seg[0] === 'category' ? pages.categoryPage : seg[0] === 'hazard' ? pages.hazardPage : pages.brandPage;
      const page = await fn(env, seg[1]!, n);
      if (page) return render(env, page, { max: 600, s: 3600 });
      break;
    }
    case 'browse': if (seg.length === 1) return render(env, await pages.browsePage(env), { max: 600, s: 3600 }); break;
    case 'brands': if (seg.length === 1) return render(env, await pages.brandsIndex(env), { max: 600, s: 3600 }); break;
    case 'search': if (seg.length === 1) return render(env, await pages.searchPage(env, url.searchParams.get('q') ?? ''), { max: 0, s: 300 }); break;
    case 'guides': {
      if (seg.length === 1) return render(env, guidesIndex(env), { max: 3600, s: 86400 });
      const g = seg.length === 2 ? getGuide(seg[1]!) : undefined;
      if (g) return render(env, guidePage(env, g), { max: 3600, s: 86400 });
      break;
    }
    case 'about': case 'privacy': case 'terms': case 'contact': {
      if (seg.length !== 1) break;
      const p = staticPage(env, seg[0] as 'about' | 'privacy' | 'terms' | 'contact');
      if (p) return render(env, p, { max: 3600, s: 86400 });
      break;
    }
  }
  return render(env, pages.notFoundPage());
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    const cache = (caches as unknown as { default: Cache }).default;
    const reqUrl = new URL(request.url);
    // Caching is on in production only (the deploy script sets CACHE_VERSION), so local development always shows fresh pages.
    const isCacheable = Boolean(env.CACHE_VERSION) && !reqUrl.pathname.startsWith('/search/');
    // The cache key carries a per-deploy version, so a new deploy never serves pages rendered by old code.
    const key = new Request(`${reqUrl.origin}/__cache/${env.CACHE_VERSION}${reqUrl.pathname}${reqUrl.search}`);
    if (isCacheable) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
    try {
      const res = await route(request, env);
      if (isCacheable && res.status === 200) ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    } catch (err) {
      console.error('render failed', request.url, err);
      return new Response('Temporarily unavailable. Please try again shortly.', { status: 503, headers: { 'Retry-After': '120', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const result = await syncRecalls(env);
    const urls = [...result.added, ...result.changed]
      .filter((r) => isIndexable({ eligible: r.eligible, idx_rank: r.idx_rank ?? 0 }, env))
      .map((r) => `${env.SITE_URL}/recall/${r.slug}/`);
    ctx.waitUntil(pingIndexNow(env, urls));
    console.log(`sync ok: fetched=${result.fetched} added=${result.added.length} changed=${result.changed.length}`);
  },
} satisfies ExportedHandler<Env>;

