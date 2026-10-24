import { makesList } from './cars/db.ts';
import { brandName, categoryStats, countCards, filters, groupBy, hazardCounts, listCards, relatedCards, searchCards, type RecallCard } from './db.ts';
import { CATEGORIES, HAZARDS, OTHER_CATEGORY, displayNumber } from './derive.ts';
import { esc, fmtDate, html, plural, raw, truncate, type Html } from './html.ts';
import { adSlot, type PageMeta } from './layout.ts';
import { abs, breadcrumbLd, faqLd, isIndexable, itemListLd, websiteLd, type Crumb } from './seo.ts';
import type { Env, Recall } from './types.ts';

export interface Page { meta: PageMeta; body: Html; status?: number }

export const PAGE_SIZE = 30;
const MIN_BRAND_RECALLS = 3;
const MIN_HUB_RECALLS = 8;

export const categoryInfo = (slug: string) => CATEGORIES.find((c) => c.slug === slug) ?? (slug === OTHER_CATEGORY.slug ? { ...OTHER_CATEGORY, test: /$^/, tech: false } : undefined);
export const hazardInfo = (slug: string) => HAZARDS.find((h) => h.slug === slug);

const recallPath = (slug: string) => `/recall/${slug}/`;
export const pagePath = (base: string, page: number) => (page <= 1 ? base : `${base}page/${page}/`);

const linkify = (text: string): Html =>
  raw(
    esc(text)
      .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:)]/g, (u) => `<a href="${u}" rel="nofollow noopener" target="_blank">${u}</a>`)
      .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, (m) => `<a href="mailto:${m}">${m}</a>`),
  );

export const crumbsHtml = (crumbs: Crumb[]): Html =>
  html`<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => (i === crumbs.length - 1 ? html`<span aria-current="page">${c.name}</span>` : html`<a href="${c.path}">${c.name}</a> / `))}</nav>`;

export function pagination(base: string, page: number, total: number): Html {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return raw('');
  return html`<nav class="pager" aria-label="Pagination">${page > 1 ? html`<a rel="prev" href="${pagePath(base, page - 1)}">← Newer</a>` : html`<span></span>`}<span>Page ${page} of ${pages}</span>${page < pages ? html`<a rel="next" href="${pagePath(base, page + 1)}">Older →</a>` : html`<span></span>`}</nav>`;
}

function cardList(cards: RecallCard[]): Html {
  return html`<ul class="list">${cards.map((c) => {
    const cat = categoryInfo(c.category);
    return html`<li><a class="t" href="${recallPath(c.slug)}">${c.short_title}</a><br><small>${fmtDate(c.date)}${c.brand ? html` · ${c.brand}` : ''}${cat ? html` · ${cat.name}` : ''}</small>${c.snippet ? html`<p>${c.snippet}</p>` : ''}</li>`;
  })}</ul>`;
}

export function faqBlock(items: { q: string; a: string }[], heading = 'Frequently asked questions'): Html {
  if (!items.length) return raw('');
  return html`<section aria-labelledby="faq"><h2 id="faq">${heading}</h2>${items.map((f) => html`<details><summary>${f.q}</summary><p>${f.a}</p></details>`)}</section>`;
}

export const sentence = (s: string, n = 2) => (s.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [s]).slice(0, n).join('').trim();

// ---------- recall detail ----------

export async function recallPage(env: Env, r: Recall): Promise<Page> {
  const path = recallPath(r.slug);
  const num = displayNumber(r.number);
  const cat = categoryInfo(r.category);
  const hazardNames = r.hazards.map((h) => hazardInfo(h)?.name).filter(Boolean) as string[];
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Recalls', path: '/recalls/' }];
  if (cat) crumbs.push({ name: cat.name, path: `/category/${cat.slug}/` });
  crumbs.push({ name: r.short_title, path });

  const [related, brandTotal, catStats] = await Promise.all([relatedCards(env.DB, r), r.brand_slug ? countCards(env.DB, filters.brand(r.brand_slug)) : Promise.resolve(0), categoryStats(env.DB, r.category)]);

  const productNames = r.products.map((p) => p.name).filter(Boolean);
  const hazardText = r.hazard_clause || (hazardNames.length ? `${hazardNames.join(', ')} hazard` : '');
  const faq: { q: string; a: string }[] = [];
  if (productNames.length) faq.push({ q: 'What was recalled?', a: `${productNames.join('; ')}${r.units ? ` (${r.units} units)` : ''}. ${sentence(r.description, 1)}` });
  if (hazardText) faq.push({ q: `Why was it recalled?`, a: `CPSC lists the reason as: ${hazardText}.` });
  faq.push({ q: 'What should I do if I own one?', a: r.remedy ? truncate(r.remedy, 420) : 'Follow the instructions in the official CPSC recall notice linked on this page.' });
  if (r.sold_at) faq.push({ q: 'Where was it sold?', a: truncate(r.sold_at, 360) });

  const label = r.hazards[0] ? (hazardInfo(r.hazards[0])?.label ?? '') : '';
  // Keep the product name whole; add the hazard label and recall number only while they fit.
  let title = truncate(r.short_title, 66);
  for (const extra of [label ? ` – ${label}` : '', ` (Recall ${num})`]) if (extra && title.length + extra.length <= 68) title += extra;
  const description = truncate(`${r.title}. ${sentence(r.description, 1)} Recall ${num}, ${fmtDate(r.date)}: affected models, remedy and the official CPSC notice.`, 158);

  const jsonLd: unknown[] = [
    {
      '@context': 'https://schema.org', '@type': 'Article', headline: truncate(r.title, 110), description,
      datePublished: r.date, dateModified: r.last_publish, mainEntityOfPage: abs(env, path),
      author: { '@type': 'Organization', name: env.SITE_NAME, url: abs(env, '/about/') },
      publisher: { '@id': `${env.SITE_URL}/#organization` },
      ...(r.images[0] ? { image: r.images[0].url } : {}),
      about: { '@type': 'Product', name: productNames[0] ?? r.short_title, ...(r.brand ? { brand: { '@type': 'Brand', name: r.brand } } : {}) },
      isBasedOn: r.url,
    },
    breadcrumbLd(env, crumbs),
  ];
  if (faq.length >= 2) jsonLd.push(faqLd(faq));

  const facts: [string, Html | string][] = [];
  facts.push(['Recall number', `${num} (CPSC)`]);
  facts.push(['Recall date', fmtDate(r.date)]);
  if (r.brand) facts.push(['Brand', r.brand_slug && brandTotal >= MIN_BRAND_RECALLS ? html`<a href="/brand/${r.brand_slug}/">${r.brand}</a>` : r.brand]);
  if (cat) facts.push(['Category', html`<a href="/category/${cat.slug}/">${cat.name}</a>`]);
  if (productNames.length) facts.push(['Products', productNames.join('; ')]);
  if (hazardText) facts.push(['Hazard', hazardText]);
  if (r.hazards.length) facts.push(['Hazard type', html`${r.hazards.map((h) => { const hz = hazardInfo(h); return hz ? html`<a class="pill" href="/hazard/${hz.slug}/">${hz.name}</a>` : ''; })}`]);
  if (r.remedy_options.length) facts.push(['Remedy', r.remedy_options.join(', ')]);
  if (r.units) facts.push(['Units', r.units]);
  if (r.countries.length) facts.push(['Made in', r.countries.join(', ')]);
  facts.push(['Last updated by CPSC', fmtDate(r.last_publish)]);

  const history: Html[] = [];
  if (r.brand_slug && brandTotal > 1) history.push(html`<p>${r.brand} appears in ${plural(brandTotal, 'CPSC recall')} on record${brandTotal >= MIN_BRAND_RECALLS ? html`. <a href="/brand/${r.brand_slug}/">See all ${r.brand} recalls</a>.` : '.'}</p>`);
  if (cat && catStats.total > 0) history.push(html`<p>Since 2019 CPSC has recorded ${plural(catStats.total, 'recall')} in the <a href="/category/${cat.slug}/">${cat.name.toLowerCase()}</a> category, ${plural(catStats.lastYear, 'recall')} of them in the past 12 months.</p>`);

  const body = html`
${crumbsHtml(crumbs)}
<article>
<h1>${r.title}</h1>
<p class="meta">Recall ${num} · ${fmtDate(r.date)}${r.brand ? html` · ${r.brand}` : ''}</p>
${r.remedy ? html`<div class="alert"><strong>What to do</strong>${linkify(truncate(r.remedy, 700))}</div>` : html`<div class="alert"><strong>What to do</strong>Follow the instructions in the official CPSC notice below.</div>`}
<p><a class="btn" href="${r.url}" rel="noopener" target="_blank">Read the official CPSC notice</a></p>
<section aria-labelledby="glance"><h2 id="glance">Recall at a glance</h2><div class="box"><dl class="facts">${facts.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl></div></section>
${adSlot(env, 'recall-top')}
<section aria-labelledby="desc"><h2 id="desc">What was recalled</h2><p>${r.description}</p></section>
${r.products.length ? html`<section aria-labelledby="affected"><h2 id="affected">Is my product affected?</h2><p>Compare your product with the details below, including model numbers where listed.</p><ul>${r.products.map((p) => html`<li><strong>${p.name || 'Product'}</strong>${p.model ? html` · Model ${p.model}` : ''}${p.units ? html` · ${p.units} units` : ''}${p.description ? html`<br>${p.description}` : ''}</li>`)}</ul></section>` : ''}
${r.images.length ? html`<section aria-labelledby="photos"><h2 id="photos">Photos from the recall notice</h2><div class="gallery">${r.images.slice(0, 4).map((i) => html`<figure><div class="ph"><img src="${i.url}" alt="${i.caption || r.short_title}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>${i.caption ? html`<figcaption>${i.caption}</figcaption>` : ''}</figure>`)}</div></section>` : ''}
${r.sold_at || r.firms.length ? html`<section aria-labelledby="sold"><h2 id="sold">Where it was sold</h2>${r.sold_at ? html`<p>${r.sold_at}</p>` : ''}${r.firms.length ? html`<p>Companies named in the notice: ${r.firms.join('; ')}.</p>` : ''}</section>` : ''}
${r.injuries ? html`<section aria-labelledby="inj"><h2 id="inj">Injuries or incidents reported</h2><p>${r.injuries}</p></section>` : ''}
${r.contact ? html`<section aria-labelledby="contact"><h2 id="contact">Consumer contact</h2><p>${linkify(r.contact)}</p></section>` : ''}
${history.length ? html`<section aria-labelledby="ctx"><h2 id="ctx">Recall history and context</h2>${history}</section>` : ''}
${faqBlock(faq)}
${adSlot(env, 'recall-bottom')}
${related.brand.length ? html`<section aria-labelledby="more-brand"><h2 id="more-brand">More recalls from ${r.brand}</h2>${cardList(related.brand)}</section>` : ''}
${related.category.length ? html`<section aria-labelledby="similar"><h2 id="similar">Similar recalls${cat ? html` in ${cat.name.toLowerCase()}` : ''}</h2>${cardList(related.category)}</section>` : ''}
<p class="disclaimer">Source: U.S. Consumer Product Safety Commission recall data, shown as published and last updated by CPSC on ${fmtDate(r.last_publish)}. Details can change; the <a href="${r.url}" rel="noopener" target="_blank">official notice</a> is the authority. If your product may be recalled, stop and read the notice before deciding what to do. <a href="/terms/">Terms and disclaimer</a>.</p>
</article>`;

  return {
    meta: { title, description, path, index: isIndexable(r, env), jsonLd, ogType: 'article', published: r.date, modified: r.last_publish, nav: 'recalls' },
    body,
  };
}

// ---------- lists ----------

export async function recallsIndex(env: Env, page: number): Promise<Page> {
  const total = await countCards(env.DB, filters.all());
  const cards = await listCards(env.DB, filters.all(), PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Latest recalls', path: pagePath('/recalls/', page) }];
  return {
    meta: {
      title: page === 1 ? 'Latest US consumer product recalls (updated daily)' : `Consumer product recalls, page ${page}`,
      description: `The most recent US consumer product recalls from the CPSC, newest first: toys, chargers, appliances, baby products and more. ${plural(total, 'recall')} on record.`,
      path: pagePath('/recalls/', page), index: page === 1, nav: 'recalls',
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, 'Latest recalls', cards.slice(0, 20).map((c) => ({ name: c.short_title, path: recallPath(c.slug) })))],
    },
    body: html`${crumbsHtml(crumbs)}<h1>Latest product recalls</h1><p class="lede">Newest US consumer product recalls first, pulled from the CPSC feed twice a day. ${plural(total, 'recall')} on record.</p>${cardList(cards)}${pagination('/recalls/', page, total)}`,
    status: cards.length || page === 1 ? 200 : 404,
  };
}

async function hubHazardStats(env: Env, f: ReturnType<typeof filters.category>): Promise<{ slug: string; n: number }[]> {
  const counts = await Promise.all(HAZARDS.map((h) => countCards(env.DB, { where: `${f.where} AND hazards LIKE ?`, params: [...f.params, `%|${h.slug}|%`] })));
  return HAZARDS.map((h, i) => ({ slug: h.slug, n: counts[i] ?? 0 })).filter((h) => h.n > 0).sort((a, b) => b.n - a.n);
}

export async function categoryPage(env: Env, slug: string, page: number): Promise<Page | null> {
  const info = categoryInfo(slug);
  if (!info) return null;
  const f = filters.category(slug);
  const [total, cards, stats, hazards, eligibleCount] = await Promise.all([countCards(env.DB, f), listCards(env.DB, f, PAGE_SIZE, (page - 1) * PAGE_SIZE), categoryStats(env.DB, slug), hubHazardStats(env, f), countCards(env.DB, { where: 'category = ? AND eligible = 1', params: [slug] })]);
  if (!total || (page > 1 && !cards.length)) return null;
  const base = `/category/${slug}/`;
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Browse', path: '/browse/' }, { name: info.name, path: pagePath(base, page) }];
  const top = hazards[0] ? hazardInfo(hazards[0].slug) : undefined;
  const faq = [
    { q: `How many ${info.plural} have been recalled?`, a: `CPSC has ${plural(total, 'recall')} on record for ${info.plural}, including ${plural(stats.total, 'recall')} since 2019 and ${plural(stats.lastYear, 'recall')} in the past 12 months.` },
    ...(top ? [{ q: `What is the most common hazard in ${info.name.toLowerCase()} recalls?`, a: `${top.name} is the most common hazard type, appearing in ${plural(hazards[0]!.n, 'recall')} in this category.` }] : []),
    { q: `How do I check whether my ${info.name.toLowerCase()} product is recalled?`, a: 'Search by brand or product name on this site, then open the recall and compare the model numbers and dates with your product. Always confirm in the official CPSC notice.' },
  ];
  const title = page === 1 ? `${info.name} recalls: full list and hazards` : `${info.name} recalls, page ${page}`;
  return {
    meta: {
      title, description: truncate(`${plural(total, 'recall')} for ${info.plural}: latest recalls, common hazards and what to do. ${info.blurb}`, 158),
      path: pagePath(base, page), index: page === 1 && eligibleCount >= MIN_HUB_RECALLS, nav: 'categories',
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, `${info.name} recalls`, cards.slice(0, 20).map((c) => ({ name: c.short_title, path: recallPath(c.slug) }))), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>${info.name} recalls</h1><p class="lede">${info.blurb} CPSC has recorded ${plural(total, 'recall')} in this category, ${plural(stats.lastYear, 'recall')} in the past 12 months.</p>
${hazards.length ? html`<h2>Most common hazards</h2><div class="tags">${hazards.slice(0, 6).map((h) => { const hz = hazardInfo(h.slug)!; return html`<a href="/hazard/${hz.slug}/">${hz.name} (${h.n})</a>`; })}</div>` : ''}
${adSlot(env, 'category-top')}
<h2>${page === 1 ? 'Latest recalls' : `Recalls, page ${page}`}</h2>${cardList(cards)}${pagination(base, page, total)}${page === 1 ? faqBlock(faq) : ''}`,
  };
}

export async function hazardPage(env: Env, slug: string, page: number): Promise<Page | null> {
  const info = hazardInfo(slug);
  if (!info) return null;
  const f = filters.hazard(slug);
  const [total, cards, eligibleCount] = await Promise.all([countCards(env.DB, f), listCards(env.DB, f, PAGE_SIZE, (page - 1) * PAGE_SIZE), countCards(env.DB, { where: 'hazards LIKE ? AND eligible = 1', params: [`%|${slug}|%`] })]);
  if (!total || (page > 1 && !cards.length)) return null;
  const base = `/hazard/${slug}/`;
  const groups = await groupBy(env.DB, 'category');
  const perCatCounts = await Promise.all(groups.map((g) => countCards(env.DB, { where: 'category = ? AND hazards LIKE ?', params: [g.key, `%|${slug}|%`] })));
  const perCat: { slug: string; n: number }[] = groups.map((g, i) => ({ slug: g.key, n: perCatCounts[i] ?? 0 })).filter((c) => c.n > 0);
  perCat.sort((a, b) => b.n - a.n);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Browse', path: '/browse/' }, { name: info.name, path: pagePath(base, page) }];
  const faq = [
    { q: `Which products are recalled most often for ${info.plural}?`, a: perCat.length ? `${perCat.slice(0, 3).map((c) => `${categoryInfo(c.slug)?.name ?? c.slug} (${c.n})`).join(', ')} lead the list of recalls tied to ${info.plural}.` : `See the list below for recent examples.` },
    { q: `How many recalls involve ${info.plural}?`, a: `CPSC has ${plural(total, 'recall')} on record that involve ${info.plural}.` },
  ];
  return {
    meta: {
      title: page === 1 ? `${info.name} recalls: latest and full list` : `${info.name} recalls, page ${page}`,
      description: truncate(`${plural(total, 'product recall')} involving ${info.plural}. ${info.blurb} See the latest recalls and which categories are affected most.`, 158),
      path: pagePath(base, page), index: page === 1 && eligibleCount >= MIN_HUB_RECALLS, nav: 'categories',
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, `${info.name} recalls`, cards.slice(0, 20).map((c) => ({ name: c.short_title, path: recallPath(c.slug) }))), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>${info.name} recalls</h1><p class="lede">${info.blurb} ${plural(total, 'recall')} on record.</p>
${perCat.length ? html`<h2>Categories affected</h2><div class="tags">${perCat.slice(0, 8).map((c) => html`<a href="/category/${c.slug}/">${categoryInfo(c.slug)?.name ?? c.slug} (${c.n})</a>`)}</div>` : ''}
${adSlot(env, 'hazard-top')}
<h2>${page === 1 ? 'Latest recalls' : `Recalls, page ${page}`}</h2>${cardList(cards)}${pagination(base, page, total)}${page === 1 ? faqBlock(faq) : ''}`,
  };
}

export async function brandPage(env: Env, slug: string, page: number): Promise<Page | null> {
  const name = await brandName(env.DB, slug);
  if (!name) return null;
  const f = filters.brand(slug);
  const [total, cards, eligibleCount, hazards, cats] = await Promise.all([
    countCards(env.DB, f), listCards(env.DB, f, PAGE_SIZE, (page - 1) * PAGE_SIZE), countCards(env.DB, { where: 'brand_slug = ? AND eligible = 1', params: [slug] }),
    hubHazardStats(env, f as ReturnType<typeof filters.category>), env.DB.prepare('SELECT category, COUNT(*) AS n FROM recalls WHERE brand_slug = ? GROUP BY category ORDER BY n DESC').bind(slug).all<{ category: string; n: number }>(),
  ]);
  if (!total || (page > 1 && !cards.length)) return null;
  const range = await env.DB.prepare('SELECT MIN(date) AS first, MAX(date) AS last FROM recalls WHERE brand_slug = ?').bind(slug).first<{ first: string; last: string }>();
  const base = `/brand/${slug}/`;
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Brands', path: '/brands/' }, { name: name, path: pagePath(base, page) }];
  const faq = [
    { q: `Has ${name} had product recalls?`, a: `Yes. CPSC lists ${plural(total, 'recall')} connected to ${name}, from ${fmtDate(range?.first ?? '')} to ${fmtDate(range?.last ?? '')}.` },
    ...(hazards[0] ? [{ q: `What are ${name} recalls usually about?`, a: `The most common hazard type is ${hazardInfo(hazards[0].slug)?.name.toLowerCase()}, in ${plural(hazards[0].n, 'recall')}.` }] : []),
    { q: `What should I do if I own a recalled ${name} product?`, a: 'Open the recall, compare the model and dates, and follow the remedy in the official CPSC notice, which may be a refund, repair or replacement.' },
  ];
  return {
    meta: {
      title: page === 1 ? `${name} recalls: ${plural(total, 'recall')} on record` : `${name} recalls, page ${page}`,
      description: `Every ${name} product recall in the CPSC database (${plural(total, 'recall')}): products, hazards, remedies and official notices.`,
      path: pagePath(base, page), index: page === 1 && eligibleCount >= MIN_BRAND_RECALLS, nav: 'brands',
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, `${name} recalls`, cards.slice(0, 20).map((c) => ({ name: c.short_title, path: recallPath(c.slug) }))), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>${name} recalls</h1><p class="lede">${plural(total, 'recall')} connected to ${name} in CPSC data, ${fmtDate(range?.first ?? '')} to ${fmtDate(range?.last ?? '')}.</p>
${cats.results.length ? html`<div class="tags">${cats.results.slice(0, 6).map((c) => html`<a href="/category/${c.category}/">${categoryInfo(c.category)?.name ?? c.category} (${c.n})</a>`)}</div>` : ''}
${adSlot(env, 'brand-top')}
<h2>${page === 1 ? 'All recalls' : `Recalls, page ${page}`}</h2>${cardList(cards)}${pagination(base, page, total)}${page === 1 ? faqBlock(faq) : ''}`,
  };
}

export async function browsePage(env: Env): Promise<Page> {
  const groups = await groupBy(env.DB, 'category');
  const counts = await hazardCounts(env.DB, HAZARDS.map((h) => h.slug));
  const ordered = [...groups].sort((a, b) => Number(Boolean(categoryInfo(b.key)?.tech)) - Number(Boolean(categoryInfo(a.key)?.tech)) || b.n - a.n);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Browse', path: '/browse/' }];
  return {
    meta: {
      title: 'Browse product recalls by category and hazard',
      description: 'Browse US consumer product recalls by category (power banks, chargers, baby products, toys, appliances) and by hazard (fire, shock, choking, falls).',
      path: '/browse/', nav: 'categories', jsonLd: [breadcrumbLd(env, crumbs)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>Browse recalls</h1><p class="lede">Find recalls by what the product is, or by what can go wrong.</p>
<h2>By category</h2><ul class="cards">${ordered.map((g) => { const c = categoryInfo(g.key); return c ? html`<li><a class="card" href="/category/${c.slug}/"><b>${c.name}</b><small>${plural(g.n, 'recall')}</small><p>${c.blurb}</p></a></li>` : ''; })}</ul>
${adSlot(env, 'browse')}
<h2>By hazard</h2><ul class="cards">${HAZARDS.map((h) => html`<li><a class="card" href="/hazard/${h.slug}/"><b>${h.name}</b><small>${plural(counts[h.slug] ?? 0, 'recall')}</small><p>${h.blurb}</p></a></li>`)}</ul>`,
  };
}

export async function brandsIndex(env: Env): Promise<Page> {
  const groups = (await groupBy(env.DB, 'brand_slug', MIN_BRAND_RECALLS)).filter((g) => g.name);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Brands', path: '/brands/' }];
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return {
    meta: { title: `Recalls by brand: ${groups.length} brands with 3+ recalls`, description: 'Brands with the most US product recalls on record, from household names to online sellers. Open a brand to see every recall.', path: '/brands/', nav: 'brands', jsonLd: [breadcrumbLd(env, crumbs)] },
    body: html`${crumbsHtml(crumbs)}<h1>Recalls by brand</h1><p class="lede">Brands with three or more recalls on record. Use search to find any other brand.</p>
<h2>Most recalls</h2><ul class="cards">${groups.slice(0, 12).map((g) => html`<li><a class="card" href="/brand/${g.key}/"><b>${g.name}</b><small>${plural(g.n, 'recall')} · latest ${fmtDate(g.latest)}</small></a></li>`)}</ul>
<h2>All brands, A to Z</h2><div class="tags">${sorted.map((g) => html`<a href="/brand/${g.key}/">${g.name} (${g.n})</a>`)}</div>`,
  };
}

export async function searchPage(env: Env, q: string): Promise<Page> {
  const query = q.trim().slice(0, 80);
  const cards = query ? await searchCards(env.DB, query) : [];
  return {
    meta: { title: query ? `Search results for “${query}”` : 'Search recalls', description: 'Search US consumer product recalls by brand or product name.', path: '/search/', index: false, q: query },
    body: html`<h1>${query ? html`Results for “${query}”` : 'Search recalls'}</h1>
${query ? (cards.length ? html`<p>${plural(cards.length, 'recall')} found${cards.length >= 40 ? ' (showing the 40 most recent)' : ''}.</p>${cardList(cards)}` : html`<p>No recalls matched “${query}”. Try a shorter brand or product name, for example “power bank” or “Anker”.</p>`) : html`<p>Type a brand or product name in the box above.</p>`}
<p class="disclaimer">A missing result does not mean a product is safe. Check <a href="https://www.cpsc.gov/Recalls" rel="noopener" target="_blank">cpsc.gov/Recalls</a> too.</p>`,
  };
}

// ---------- home ----------

export async function homePage(env: Env): Promise<Page> {
  const [latest, groups, total, brands, carMakes] = await Promise.all([
    listCards(env.DB, filters.all(), 12, 0),
    groupBy(env.DB, 'category'),
    countCards(env.DB, filters.all()),
    groupBy(env.DB, 'brand_slug', MIN_BRAND_RECALLS),
    makesList(env.DB),
  ]);
  const cats = [...groups].sort((a, b) => Number(Boolean(categoryInfo(b.key)?.tech)) - Number(Boolean(categoryInfo(a.key)?.tech)) || b.n - a.n).filter((g) => g.key !== OTHER_CATEGORY.slug).slice(0, 12);
  const faq = [
    { q: 'How do I find out if a product I own has been recalled?', a: 'Search by brand or product name here, or browse by category, then compare the model number, date codes and where you bought it with the details in the recall. Confirm in the official CPSC notice linked on each page.' },
    { q: 'What should I do if my product is recalled?', a: 'Stop using it if the notice says to, and follow the remedy it describes, which is usually a refund, a repair or a replacement. Recalls do not expire, so it is still worth acting on an old one.' },
    { q: 'Where does this recall information come from?', a: `It comes from the U.S. Consumer Product Safety Commission (CPSC) recall data, pulled automatically twice a day. ${env.SITE_NAME} is independent and not affiliated with CPSC.` },
  ];
  return {
    meta: {
      title: `${env.SITE_NAME}: check US product, car and food recalls (updated daily)`,
      description: 'Search US product recalls (CPSC), car recalls (NHTSA) and food recalls (FDA): chargers, appliances, cars, allergens, Listeria and more. See the risk, the fix and the official notice.',
      path: '/', nav: '', fullWidth: true, jsonLd: [websiteLd(env), faqLd(faq)],
    },
    body: html`<section class="hero"><div class="wrap">
<h1>Is your product recalled?</h1>
<p class="lede">Search ${plural(total, 'US consumer product recall')} from the CPSC. Find out what the hazard is, whether your model is affected and what to do next.</p>
<form action="/search/" method="get" role="search"><label for="hq" style="position:absolute;left:-999px">Search recalls</label><input id="hq" name="q" type="search" placeholder="Try “power bank”, “Anker” or “high chair”" autocomplete="off" enterkeyhint="search" maxlength="80"><button type="submit">Check</button></form>
<p class="disclaimer">Updated automatically from official CPSC data. Not affiliated with CPSC.</p>
</div></section>
<div class="wrap">
<h2>Latest recalls</h2>${cardList(latest)}<p><a href="/recalls/">See all recent recalls →</a></p>
${adSlot(env, 'home-top')}
${carMakes.length ? html`<h2>Car recalls by make</h2><div class="tags">${carMakes.slice(0, 16).map((m) => html`<a href="/cars/${m.make_slug}/">${m.make} (${m.recalls})</a>`)}</div><p><a href="/cars/">Browse all car recalls by make, model and year →</a> · <a href="/food/">Food recalls (FDA) →</a></p>` : ''}
<h2>Browse by category</h2><ul class="cards">${cats.map((g) => { const c = categoryInfo(g.key); return c ? html`<li><a class="card" href="/category/${c.slug}/"><b>${c.name}</b><small>${plural(g.n, 'recall')}</small></a></li>` : ''; })}</ul>
<h2>Browse by hazard</h2><div class="tags">${HAZARDS.map((h) => html`<a href="/hazard/${h.slug}/">${h.name}</a>`)}</div>
${brands.length ? html`<h2>Brands with the most recalls</h2><div class="tags">${brands.filter((b) => b.name).slice(0, 14).map((b) => html`<a href="/brand/${b.key}/">${b.name} (${b.n})</a>`)}</div>` : ''}
<section class="prose"><h2>Guides</h2><ul>
<li><a href="/guides/how-to-check-if-a-product-is-recalled/">How to check if a product is recalled</a></li>
<li><a href="/guides/what-to-do-with-a-recalled-product/">What to do if you own a recalled product</a></li>
<li><a href="/guides/e-bike-scooter-battery-charging-safety/">E-bike and scooter battery charging safety</a></li></ul></section>
${faqBlock(faq)}
</div>`,
  };
}

export const notFoundPage = (): Page => ({
  meta: { title: 'Page not found', description: 'This page does not exist.', path: '/404/', index: false },
  body: html`<h1>Page not found</h1><p>That page does not exist. It may have moved, or the address may be mistyped.</p><p><a href="/">Go to the home page</a>, <a href="/recalls/">see the latest recalls</a> or use the search box above.</p>`,
  status: 404,
});
