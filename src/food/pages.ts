import { fmtDate, html, plural, truncate, type Html } from '../html.ts';
import { adSlot } from '../layout.ts';
import { PAGE_SIZE, crumbsHtml, faqBlock, pagePath, pagination, sentence, type Page } from '../pages.ts';
import { breadcrumbLd, faqLd, foodIndexBudget, itemListLd, type Crumb } from '../seo.ts';
import type { Env } from '../types.ts';
import { countFood, firmName, foodFilters, foodGroups, foodHazardCounts, getFoodEvent, listFood, relatedFood, searchFood, type FoodCard } from './db.ts';
import { CLASS_INFO, FIRST_FOOD_YEAR, FOOD_CATEGORIES, FOOD_HAZARDS, OTHER_FOOD, foodCategoryInfo, foodHazardInfo } from './derive.ts';

const FDA_ENFORCEMENT = 'https://www.accessdata.fda.gov/scripts/ires/index.cfm';
const FDA_RECALLS = 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts';
const FDA_CLASSES = 'https://www.fda.gov/safety/industry-guidance-recalls/recalls-background-and-definitions';
const MIN_HUB = 8;
const MIN_FIRM = 3;

export const foodPath = (slug: string) => `/food/recall/${slug}/`;
const clsPill = (c: string): Html => (c ? html`<span class="pill${c === 'I' ? '' : ' cat'}">${CLASS_INFO[c]?.label ?? c}</span>` : html``);

const foodDisclaimer = (): Html => html`<p class="disclaimer">Data provided by the U.S. Food and Drug Administration (FDA) through <a href="https://open.fda.gov" rel="noopener" target="_blank">openFDA</a>, shown as published and not validated by this site. This site is independent and is not affiliated with or endorsed by FDA. It covers FDA-regulated foods; meat, poultry and egg products are regulated by USDA. Do not rely on this site for medical decisions: for health concerns contact a healthcare professional, and always follow the official notice and the company’s instructions. <a href="/terms/">Terms and disclaimer</a>.</p>`;

function foodList(cards: FoodCard[]): Html {
  return html`<ul class="list">${cards.map((c) => html`<li><a class="t" href="${foodPath(c.slug)}">${c.title}</a><br><small>${fmtDate(c.report_date)}${c.firm ? html` · ${c.firm}` : ''}${foodCategoryInfo(c.category) ? html` · ${foodCategoryInfo(c.category)!.name}` : ''}</small> ${clsPill(c.classification)}${c.snippet ? html`<p>${c.snippet}</p>` : ''}</li>`)}</ul>`;
}

export async function foodEventPage(env: Env, eventId: string, slug: string): Promise<Page | { redirect: string } | null> {
  const e = await getFoodEvent(env.DB, eventId);
  if (!e) return null;
  if (e.slug !== slug) return { redirect: foodPath(e.slug) };
  const path = foodPath(e.slug);
  const cat = foodCategoryInfo(e.category);
  const related = await relatedFood(env.DB, e);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Food recalls', path: '/food/' }];
  if (cat) crumbs.push({ name: cat.name, path: `/food/category/${cat.slug}/` });
  crumbs.push({ name: e.title, path });
  const cls = CLASS_INFO[e.classification];
  const hz = e.hazards.map((h) => foodHazardInfo(h)).filter(Boolean) as NonNullable<ReturnType<typeof foodHazardInfo>>[];
  const shown = e.products.slice(0, 25);
  const lead = e.products[0]?.description ?? '';

  const faq: { q: string; a: string }[] = [
    { q: 'What was recalled?', a: `${e.firm} recalled ${plural(e.products.length, 'product')}${lead ? `, including ${truncate(lead, 140)}` : ''}.` },
    { q: 'Why was it recalled?', a: e.reason },
  ];
  if (cls) faq.push({ q: `What does ${cls.label} mean?`, a: cls.meaning });
  if (e.distribution) faq.push({ q: 'Where was it sold or shipped?', a: truncate(e.distribution, 300) });
  faq.push({ q: 'What should I do if I have this product?', a: 'Compare the product name, size and lot or date codes with the details on this page. FDA recall notices often tell you to stop eating the product and to return it or throw it away. Follow the company’s instructions and the official FDA information. If you are unsure, do not eat it.' });

  const title = `${truncate(e.title, 62)}`;
  const description = truncate(`${e.firm} recall${cls ? ` (${cls.label})` : ''}: ${e.reason} Check product names and lot codes, and see what to do.`, 158);
  const facts: [string, Html | string][] = [['Recalling company', e.firm], ...(e.city || e.state ? [['Location', [e.city, e.state].filter(Boolean).join(', ')] as [string, string]] : []), ['Reported by FDA', fmtDate(e.reportDate)]];
  if (e.initiationDate) facts.push(['Recall started', fmtDate(e.initiationDate)]);
  if (cls) facts.push(['Risk class', `${cls.label}`]);
  if (e.status) facts.push(['Status (latest data we have)', e.status]);
  if (e.voluntary) facts.push(['Type', e.voluntary]);
  if (cat) facts.push(['Category', html`<a href="/food/category/${cat.slug}/">${cat.name}</a>`]);
  if (hz.length) facts.push(['Reason type', html`${hz.map((h) => html`<a class="pill" href="/food/hazard/${h.slug}/">${h.name}</a>`)}`]);

  return {
    meta: {
      title, description, path, nav: 'food', ogType: 'article', published: e.reportDate, modified: e.reportDate,
      index: e.eligible && e.idxRank !== null && (e.idxRank === 0 || e.idxRank <= foodIndexBudget(env)),
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Article', headline: truncate(e.title, 110), description, datePublished: e.reportDate, dateModified: e.reportDate, mainEntityOfPage: `${env.SITE_URL}${path}`, image: `${env.SITE_URL}/og.png`, author: { '@type': 'Organization', name: env.SITE_NAME, url: `${env.SITE_URL}/about/` }, publisher: { '@id': `${env.SITE_URL}/#organization` }, isBasedOn: FDA_ENFORCEMENT },
        breadcrumbLd(env, crumbs), faqLd(faq),
      ],
    },
    body: html`${crumbsHtml(crumbs)}<article>
<h1>${e.title}</h1><p class="meta">${fmtDate(e.reportDate)} · ${e.firm} ${clsPill(e.classification)}</p>
${cls ? html`<div class="alert"><strong>${cls.label}</strong>${cls.meaning}</div>` : ''}
<div class="alert"><strong>Reason for the recall</strong>${e.reason}</div>
<p><a class="btn" href="${FDA_ENFORCEMENT}" rel="noopener" target="_blank">Find the official FDA enforcement report</a></p>
<section aria-labelledby="glance"><h2 id="glance">Recall at a glance</h2><div class="box"><dl class="facts">${facts.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl></div></section>
${adSlot(env, 'food-top')}
<section aria-labelledby="affected"><h2 id="affected">Is my product affected?</h2><p>Compare your product’s name, size and lot or date codes with the list below. A recall usually covers only specific codes.</p>
<ul>${shown.map((p) => html`<li><strong>${p.description}</strong>${p.quantity ? html`<br>Quantity: ${p.quantity}` : ''}${p.code ? html`<br>Codes: ${truncate(p.code, 600)}` : ''}</li>`)}</ul>
${e.products.length > shown.length ? html`<p>and ${plural(e.products.length - shown.length, 'more product')}. See the full list in the FDA enforcement report.</p>` : ''}</section>
${e.distribution ? html`<section aria-labelledby="dist"><h2 id="dist">Where it was distributed</h2><p>${e.distribution}</p></section>` : ''}
<section aria-labelledby="todo"><h2 id="todo">What to do</h2><p>If you have this product, check the codes above. FDA recall notices often tell consumers to stop eating the product and to return it or throw it away. Follow the company’s instructions and the official FDA information, and if you are unsure, do not eat it. If someone becomes ill after eating a recalled food, contact a healthcare professional. See FDA’s <a href="${FDA_RECALLS}" rel="noopener" target="_blank">recalls and safety alerts</a> for company announcements.</p></section>
${faqBlock(faq)}${adSlot(env, 'food-bottom')}
${related.firm.length ? html`<section aria-labelledby="firm"><h2 id="firm">More recalls from ${e.firm}</h2>${foodList(related.firm)}</section>` : ''}
${related.category.length ? html`<section aria-labelledby="sim"><h2 id="sim">Similar recalls${cat ? html` in ${cat.name.toLowerCase()}` : ''}</h2>${foodList(related.category)}</section>` : ''}
<section class="source-list"><h2>Sources</h2><ul><li><a href="${FDA_ENFORCEMENT}" rel="noopener" target="_blank">FDA Enforcement Report</a></li><li><a href="${FDA_CLASSES}" rel="noopener" target="_blank">FDA: Recalls background and definitions</a></li></ul></section>
${foodDisclaimer()}</article>`,
  };
}

// ---------- hubs ----------

type HubKind = 'hazard' | 'category' | 'firm';

export async function foodHub(env: Env, kind: HubKind, slug: string, page: number): Promise<Page | null> {
  const info = kind === 'hazard' ? foodHazardInfo(slug) : kind === 'category' ? foodCategoryInfo(slug) : null;
  let name: string;
  let blurb: string;
  let plural_: string;
  let filter = foodFilters.all();
  if (kind === 'firm') {
    const n = await firmName(env.DB, slug);
    if (!n) return null;
    name = n; blurb = `Every food recall in the FDA enforcement data involving ${n}.`; plural_ = n; filter = foodFilters.firm(slug);
  } else {
    if (!info) return null;
    name = info.name; blurb = info.blurb; plural_ = info.plural; filter = kind === 'hazard' ? foodFilters.hazard(slug) : foodFilters.category(slug);
  }
  const [total, cards, eligibleCount] = await Promise.all([countFood(env.DB, filter), listFood(env.DB, filter, PAGE_SIZE, (page - 1) * PAGE_SIZE), countFood(env.DB, { where: `${filter.where} AND eligible = 1`, params: filter.params })]);
  if (!total || (page > 1 && !cards.length)) return null;
  const base = `/food/${kind}/${slug}/`;
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Food recalls', path: '/food/' }, { name: name, path: pagePath(base, page) }];

  const [hz, cats] = await Promise.all([
    Promise.all(FOOD_HAZARDS.map(async (h) => ({ h, n: await countFood(env.DB, { where: `${filter.where} AND hazards LIKE ?`, params: [...filter.params, `%|${h.slug}|%`] }) }))),
    Promise.all([...FOOD_CATEGORIES, { ...OTHER_FOOD, test: /$^/ }].map(async (c) => ({ c, n: await countFood(env.DB, { where: `${filter.where} AND category = ?`, params: [...filter.params, c.slug] }) }))),
  ]);
  const topHz = hz.filter((x) => x.n > 0 && x.h.slug !== slug).sort((a, b) => b.n - a.n).slice(0, 5);
  const topCats = cats.filter((x) => x.n > 0 && x.c.slug !== slug).sort((a, b) => b.n - a.n).slice(0, 5);
  const classes = await Promise.all(['I', 'II', 'III'].map(async (c) => ({ c, n: await countFood(env.DB, { where: `${filter.where} AND classification = ?`, params: [...filter.params, c] }) })));
  const faq = [
    { q: kind === 'firm' ? `Has ${name} had food recalls?` : `How many ${plural_} recalls are there?`, a: `The FDA enforcement data we hold lists ${plural(total, 'recall event')}${kind === 'firm' ? ` for ${name}` : ` involving ${plural_}`}, of which ${plural(classes.find((x) => x.c === 'I')?.n ?? 0, 'recall')} are Class I (FDA’s highest-risk class).` },
    ...(topHz[0] && kind !== 'hazard' ? [{ q: `What are the most common reasons?`, a: `${topHz.slice(0, 3).map((x) => `${x.h.name.toLowerCase()} (${x.n})`).join(', ')}.` }] : []),
    ...(topCats[0] && kind !== 'category' ? [{ q: 'Which kinds of food are involved?', a: `${topCats.slice(0, 3).map((x) => `${x.c.name.toLowerCase()} (${x.n})`).join(', ')}.` }] : []),
    { q: 'How do I know if my food is affected?', a: 'Open the recall and compare the product name, size and lot or date codes with what you have. If it matches, follow the company’s and FDA’s instructions.' },
  ];
  const title = page === 1 ? (kind === 'firm' ? `${name} food recalls: ${plural(total, 'recall')} on record` : `${name} food recalls: latest and full list`) : `${name} food recalls, page ${page}`;
  const index = page === 1 && eligibleCount >= (kind === 'firm' ? MIN_FIRM : MIN_HUB);
  return {
    meta: {
      title, description: truncate(`${plural(total, 'FDA food recall')} ${kind === 'firm' ? `for ${name}` : `involving ${plural_}`}: latest recalls, risk classes and what to do. ${blurb}`, 158),
      path: pagePath(base, page), index, nav: 'food',
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, `${name} food recalls`, cards.slice(0, 20).map((c) => ({ name: c.title, path: foodPath(c.slug) }))), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>${kind === 'firm' ? `${name} recalls` : `${name} food recalls`}</h1><p class="lede">${blurb} ${plural(total, 'recall event')} on record since ${FIRST_FOOD_YEAR}.</p>
${page === 1 ? html`<div class="stat">${classes.map((x) => html`<div><b>${x.n}</b><span>${CLASS_INFO[x.c]!.label}</span></div>`)}</div>
${topHz.length && kind !== 'hazard' ? html`<h2>Common reasons</h2><div class="tags">${topHz.map((x) => html`<a href="/food/hazard/${x.h.slug}/">${x.h.name} (${x.n})</a>`)}</div>` : ''}
${topCats.length && kind !== 'category' ? html`<h2>Kinds of food</h2><div class="tags">${topCats.map((x) => html`<a href="/food/category/${x.c.slug}/">${x.c.name} (${x.n})</a>`)}</div>` : ''}${adSlot(env, 'food-hub')}` : ''}
<h2>${page === 1 ? 'Latest recalls' : `Recalls, page ${page}`}</h2>${foodList(cards)}${pagination(base, page, total)}${page === 1 ? faqBlock(faq) : ''}${foodDisclaimer()}`,
  };
}

export async function foodLatest(env: Env, page: number): Promise<Page | null> {
  const [total, cards] = await Promise.all([countFood(env.DB, foodFilters.all()), listFood(env.DB, foodFilters.all(), PAGE_SIZE, (page - 1) * PAGE_SIZE)]);
  if (!cards.length) return null;
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Food recalls', path: '/food/' }, { name: 'Latest', path: pagePath('/food/latest/', page) }];
  return {
    meta: { title: page === 1 ? 'Latest FDA food recalls (updated daily)' : `Food recalls, page ${page}`, description: `The newest FDA food recalls first: allergens, Listeria, Salmonella and more. ${plural(total, 'recall event')} on record.`, path: pagePath('/food/latest/', page), index: page === 1, nav: 'food', jsonLd: [breadcrumbLd(env, crumbs)] },
    body: html`${crumbsHtml(crumbs)}<h1>Latest food recalls</h1><p class="lede">Newest FDA food recalls first.</p>${foodList(cards)}${pagination('/food/latest/', page, total)}${foodDisclaimer()}`,
  };
}

export async function foodHome(env: Env): Promise<Page> {
  const [latest, total, hazardCounts, firms, cats] = await Promise.all([
    listFood(env.DB, foodFilters.all(), 12, 0), countFood(env.DB, foodFilters.all()), foodHazardCounts(env.DB, FOOD_HAZARDS.map((h) => h.slug)),
    foodGroups(env.DB, 'firm_slug', MIN_FIRM), foodGroups(env.DB, 'category'),
  ]);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Food recalls', path: '/food/' }];
  const faq = [
    { q: 'How do I find out if my food has been recalled?', a: 'Search by brand or product, or browse by reason such as undeclared allergens or Listeria. Then compare the product name, size and lot or date codes with the recall. Confirm in FDA’s official information.' },
    { q: 'What do FDA recall classes mean?', a: `${CLASS_INFO.I!.label}: ${CLASS_INFO.I!.meaning} ${CLASS_INFO.II!.label}: ${CLASS_INFO.II!.meaning} ${CLASS_INFO.III!.label}: ${CLASS_INFO.III!.meaning}` },
    { q: 'Which foods does this cover?', a: `FDA-regulated foods, from ${FIRST_FOOD_YEAR}: produce, dairy, seafood, snacks, supplements and more. Meat, poultry and processed egg products are regulated by USDA and are not included here.` },
    { q: 'Where does this recall information come from?', a: `From the FDA enforcement reports through openFDA, updated automatically. ${env.SITE_NAME} is independent and not affiliated with FDA.` },
  ];
  return {
    meta: {
      title: 'Food recalls: search FDA recalls by brand, allergen or Listeria', description: `Search ${plural(total, 'FDA food recall event')} since ${FIRST_FOOD_YEAR}: undeclared allergens, Listeria, Salmonella and more. See the risk class, lot codes and what to do.`,
      path: '/food/', nav: 'food', jsonLd: [breadcrumbLd(env, crumbs), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>Food recalls</h1>
<p class="lede">Search FDA food recalls by product or brand, or browse by reason. ${plural(total, 'recall event')} since ${FIRST_FOOD_YEAR}, updated automatically.</p>
<form action="/food/search/" method="get" role="search" class="hero" style="padding:0;border:0;background:none"><label for="fq" style="position:absolute;left:-999px">Search food recalls</label><input id="fq" name="q" type="search" placeholder="Try “peanut butter”, “Trader Joe’s” or “spinach”" autocomplete="off" maxlength="60"><button type="submit">Search</button></form>
<div class="box"><strong>Have the product in front of you?</strong> Check the name, size and lot or date codes against the recall. Do not eat a product that matches a recall notice, and follow the company’s and FDA’s instructions.</div>
${adSlot(env, 'food-home')}
<h2>By reason for the recall</h2><ul class="cards">${FOOD_HAZARDS.map((h) => html`<li><a class="card" href="/food/hazard/${h.slug}/"><b>${h.name}</b><small>${plural(hazardCounts[h.slug] ?? 0, 'recall')}</small><p>${h.blurb}</p></a></li>`)}</ul>
<h2>By kind of food</h2><div class="tags">${cats.map((g) => { const c = foodCategoryInfo(g.key); return c ? html`<a href="/food/category/${c.slug}/">${c.name} (${g.n})</a>` : ''; })}</div>
${firms.length ? html`<h2>Companies with the most recalls</h2><div class="tags">${firms.filter((f) => f.name).slice(0, 16).map((f) => html`<a href="/food/firm/${f.key}/">${f.name} (${f.n})</a>`)}</div>` : ''}
<h2>Latest food recalls</h2>${foodList(latest)}<p><a href="/food/latest/">See all recent food recalls →</a></p>
${faqBlock(faq)}${foodDisclaimer()}`,
  };
}

export async function foodSearch(env: Env, q: string): Promise<Page> {
  const query = q.trim().slice(0, 60);
  const cards = query ? await searchFood(env.DB, query) : [];
  return {
    meta: { title: query ? `Food recall search: “${query}”` : 'Search food recalls', description: 'Search FDA food recalls by product or brand.', path: '/food/search/', index: false, nav: 'food', q: '' },
    body: html`<h1>${query ? html`Food results for “${query}”` : 'Search food recalls'}</h1>${query ? (cards.length ? html`<p>${plural(cards.length, 'recall')} found.</p>${foodList(cards)}` : html`<p>No food recalls matched “${query}”. Try a shorter product or brand name, for example “spinach” or “cheese”.</p>`) : html`<p>Type a product or brand name.</p>`}
<p class="disclaimer">A missing result does not mean a food is safe. Check <a href="${FDA_RECALLS}" rel="noopener" target="_blank">FDA’s recalls page</a> too, and note that meat and poultry recalls come from USDA.</p>`,
  };
}

