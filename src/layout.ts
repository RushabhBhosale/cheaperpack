import { CSS } from './styles.ts';
import { esc, html, raw, truncate, type Html } from './html.ts';
import { abs, ldScripts, metaDescription, organizationLd } from './seo.ts';
import type { Env } from './types.ts';

export interface PageMeta {
  title: string;
  description: string;
  /** Path of the canonical URL, e.g. `/recall/27042-example/`. */
  path: string;
  /** Defaults to indexable. Pass false for utility pages (search, 404, deep pagination). */
  index?: boolean;
  jsonLd?: unknown[];
  ogType?: 'website' | 'article';
  published?: string;
  modified?: string;
  nav?: 'recalls' | 'cars' | 'food' | 'categories' | 'brands' | 'guides' | '';
  /** The page supplies its own `.wrap` containers (used for the full-width home hero). */
  fullWidth?: boolean;
  /** Query string value to prefill in the header search box. */
  q?: string;
}

const NAV: { key: NonNullable<PageMeta['nav']>; href: string; label: string }[] = [
  { key: 'recalls', href: '/recalls/', label: 'Product recalls' },
  { key: 'cars', href: '/cars/', label: 'Car recalls' },
  { key: 'food', href: '/food/', label: 'Food recalls' },
  { key: 'categories', href: '/browse/', label: 'Browse' },
  { key: 'brands', href: '/brands/', label: 'Brands' },
  { key: 'guides', href: '/guides/', label: 'Guides' },
];

/** A reserved ad container. Renders nothing until AdSense is configured, so there is no layout shift. */
export function adSlot(env: Env, id: string): Html {
  if (!env.ADSENSE_PUB_ID || !env.ADSENSE_SLOT) return raw('');
  return html`<div class="ad" aria-label="Advertisement"><small>Advertisement</small><ins class="adsbygoogle" style="display:block" data-ad-client="${env.ADSENSE_PUB_ID}" data-ad-slot="${env.ADSENSE_SLOT}" data-ad-format="auto" data-full-width-responsive="true" data-slot-name="${id}"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
}

export function layout(env: Env, meta: PageMeta, body: Html): string {
  const canonical = abs(env, meta.path);
  const index = meta.index !== false;
  const title = meta.title;
  const ogImage = abs(env, '/og.png');
  const ads = env.ADSENSE_PUB_ID ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(env.ADSENSE_PUB_ID)}" crossorigin="anonymous"></script>` : '';
  const ga = env.GA_ID
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(env.GA_ID)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(env.GA_ID)}');</script>`
    : '';
  const robots = index ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,follow';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${metaDescription(meta.description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${esc(env.SITE_NAME)}: latest recalls" href="/feed.xml">
<meta name="theme-color" content="#b42318">
${env.GSC_VERIFICATION ? `<meta name="google-site-verification" content="${esc(env.GSC_VERIFICATION)}">` : ''}
<meta property="og:type" content="${meta.ogType ?? 'website'}">
<meta property="og:site_name" content="${esc(env.SITE_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${metaDescription(meta.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${metaDescription(meta.description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
${meta.ogType === 'article' && meta.published ? `<meta property="article:published_time" content="${esc(meta.published)}">` : ''}
${meta.ogType === 'article' && meta.modified ? `<meta property="article:modified_time" content="${esc(meta.modified)}">` : ''}
<style>${CSS}</style>
${ldScripts([organizationLd(env), ...(meta.jsonLd ?? [])]).__html}
${ads}${ga}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap bar">
<a class="brand" href="/"><i aria-hidden="true"></i>${esc(env.SITE_NAME)}</a>
<nav class="main" aria-label="Main">${NAV.map((n) => `<a href="${n.href}"${meta.nav === n.key ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}</nav>
<form class="search" action="/search/" method="get" role="search"><label class="sr" for="q" style="position:absolute;left:-999px">Search recalls</label><input id="q" name="q" type="search" placeholder="Search brand or product" value="${esc(meta.q ?? '')}" autocomplete="off" enterkeyhint="search" maxlength="80"><button type="submit">Search</button></form>
</div></header>
<main id="main">${meta.fullWidth ? body.__html : `<div class="wrap">${body.__html}</div>`}</main>
<footer class="site"><div class="wrap">
<div class="cols">
<div><h2>${esc(env.SITE_NAME)}</h2><p>A free, searchable index of US consumer product, car and food recalls, updated automatically from official CPSC, NHTSA and FDA data.</p></div>
<div><h2>Explore</h2><ul><li><a href="/recalls/">Product recalls</a></li><li><a href="/cars/">Car recalls</a></li><li><a href="/food/">Food recalls</a></li><li><a href="/browse/">Browse by category and hazard</a></li><li><a href="/brands/">Brands</a></li><li><a href="/feed.xml">RSS feed</a></li></ul></div>
<div><h2>Guides</h2><ul><li><a href="/guides/how-to-check-if-a-product-is-recalled/">Check if a product is recalled</a></li><li><a href="/guides/what-to-do-with-a-recalled-product/">What to do with a recalled product</a></li><li><a href="/guides/e-bike-scooter-battery-charging-safety/">E-bike and scooter battery safety</a></li></ul></div>
<div><h2>About</h2><ul><li><a href="/about/">About and methodology</a></li><li><a href="/contact/">Contact</a></li><li><a href="/privacy/">Privacy policy</a></li><li><a href="/terms/">Terms and disclaimer</a></li></ul></div>
</div>
<p class="disclaimer">${esc(env.SITE_NAME)} is an independent site and is not affiliated with, endorsed by or operated by CPSC, NHTSA, FDA or any manufacturer. Recall information comes from those agencies and is shown as published. Always follow the official notice linked on each page.</p>
<p class="disclaimer">© ${new Date().getUTCFullYear()} ${esc(env.SITE_NAME)}</p>
</div></footer>
</body>
</html>`;
}

export const notIndexed = (extra: Partial<PageMeta> = {}): Partial<PageMeta> => ({ index: false, ...extra });
