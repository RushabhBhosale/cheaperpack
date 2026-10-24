import { fmtDate, html, plural, truncate, type Html } from '../html.ts';
import { slugify } from '../derive.ts';
import { adSlot } from '../layout.ts';
import { PAGE_SIZE, crumbsHtml, faqBlock, pagePath, pagination, sentence, type Page } from '../pages.ts';
import { abs, breadcrumbLd, faqLd, isCarIndexable, itemListLd, type Crumb } from '../seo.ts';
import type { Env } from '../types.ts';
import {
  getCampaign, getCarPage, latestCarRecalls, makesList, modelsForMake, recallsForMake, recallsForModel, recallsForVehicle, searchCars, yearsForModel,
  type CarPageRow, type CarRecallRow,
} from './db.ts';
import { FIRST_CAMPAIGN_YEAR, prettyComponent } from './derive.ts';

const NHTSA_LOOKUP = 'https://www.nhtsa.gov/recalls';

export const campaignSlug = (r: Pick<CarRecallRow, 'campaign' | 'component'>) => `${r.campaign.toLowerCase()}-${slugify(prettyComponent(r.component)).slice(0, 48).replace(/-+$/, '')}`;
export const campaignPath = (r: Pick<CarRecallRow, 'campaign' | 'component'>) => `/cars/recall/${campaignSlug(r)}/`;
const vehiclePath = (make: string, model: string, year: number) => `/cars/${make}/${model}/${year}/`;
const displayCampaign = (c: string) => `${c.slice(0, 3)}-${c.slice(3, 6)}`;
const topComponent = (r: Pick<CarRecallRow, 'component'>) => prettyComponent(r.component.split(':')[0] ?? '');
const isFree = (r: CarRecallRow) => /free of charge|at no (?:cost|charge)|no cost to/i.test(r.remedy);

const lookupBox = (extra = ''): Html =>
  html`<div class="box"><strong>Check your own car by VIN.</strong> A recall applies only to certain vehicles, built in certain periods. NHTSA’s <a href="${NHTSA_LOOKUP}" rel="noopener" target="_blank">recall lookup</a> checks your 17-character VIN against open recalls and is free.${extra}</div>`;

const flags = (r: CarRecallRow): Html =>
  html`${r.do_not_drive ? html`<span class="pill">Do not drive</span>` : ''}${r.park_outside ? html`<span class="pill">Park outside</span>` : ''}${r.ota ? html`<span class="pill cat">Over-the-air fix</span>` : ''}`;

function recallList(rows: CarRecallRow[]): Html {
  return html`<ul class="list">${rows.map((r) => html`<li><a class="t" href="${campaignPath(r)}">${r.title}</a><br><small>${fmtDate(r.date)} · ${r.manufacturer} · Campaign ${displayCampaign(r.campaign)}</small> ${flags(r)}<p>${truncate(sentence(r.summary, 2), 220)}</p></li>`)}</ul>`;
}

const disclaimer = (): Html => html`<p class="disclaimer">Source: U.S. National Highway Traffic Safety Administration (NHTSA) recall data for passenger vehicles, recalls since ${FIRST_CAMPAIGN_YEAR}, shown as published. This site is independent and not affiliated with NHTSA or any manufacturer. Check your VIN at <a href="${NHTSA_LOOKUP}" rel="noopener" target="_blank">nhtsa.gov/recalls</a> and follow your manufacturer’s notice. <a href="/terms/">Terms and disclaimer</a>.</p>`;

function topComponents(rows: CarRecallRow[], n = 4): { name: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(topComponent(r), (counts.get(topComponent(r)) ?? 0) + 1);
  return [...counts.entries()].map(([name, c]) => ({ name, n: c })).sort((a, b) => b.n - a.n).slice(0, n);
}

// ---------- vehicle page: 2018 Honda Accord ----------

export async function vehiclePage(env: Env, makeSlug: string, modelSlug: string, year: number): Promise<Page | null> {
  const [row, rows, years] = await Promise.all([getCarPage(env.DB, makeSlug, modelSlug, year), recallsForVehicle(env.DB, makeSlug, modelSlug, year), yearsForModel(env.DB, makeSlug, modelSlug)]);
  if (!row || !rows.length) return null;
  const name = `${year} ${row.make} ${row.model}`;
  const path = vehiclePath(makeSlug, modelSlug, year);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Car recalls', path: '/cars/' }, { name: row.make, path: `/cars/${makeSlug}/` }, { name: row.model, path: `/cars/${makeSlug}/${modelSlug}/` }, { name: String(year), path }];
  const comps = topComponents(rows);
  const dnd = rows.filter((r) => r.do_not_drive).length;
  const outside = rows.filter((r) => r.park_outside).length;
  const free = rows.filter(isFree).length;
  const latest = rows[0]!;

  const faq: { q: string; a: string }[] = [
    { q: `Does the ${name} have recalls?`, a: `NHTSA lists ${plural(rows.length, 'recall campaign')} since ${FIRST_CAMPAIGN_YEAR} that include the ${name}, the most recent reported on ${fmtDate(latest.date)}. A campaign covers only certain vehicles, so check your VIN at nhtsa.gov/recalls to see whether yours is affected.` },
    { q: `What parts have been recalled on the ${name}?`, a: `${comps.map((c) => `${c.name} (${c.n})`).join(', ')}.` },
  ];
  if (free > 0) faq.push({ q: 'Are recall repairs free?', a: `In ${free} of the ${plural(rows.length, 'campaign')} listed here, the remedy states that the repair is free of charge. Read the remedy in each recall for the details.` });
  if (dnd > 0) faq.push({ q: `Should I stop driving my ${name}?`, a: `NHTSA marked ${plural(dnd, 'campaign')} for this model year as “do not drive”. Open the recalls below, check your VIN and follow the manufacturer’s instructions.` });

  const title = truncate(`${name} recalls: ${plural(rows.length, 'campaign')} listed by NHTSA`, 66);
  const description = truncate(`NHTSA lists ${plural(rows.length, 'recall')} for the ${name}, latest ${fmtDate(latest.date)}. Recalled parts: ${comps.map((c) => c.name.toLowerCase()).join(', ')}. See the risk, the remedy and how to check your VIN.`, 158);

  const body = html`${crumbsHtml(crumbs)}
<h1>${name} recalls</h1>
<p class="lede">NHTSA lists ${plural(rows.length, 'recall campaign')} since ${FIRST_CAMPAIGN_YEAR} that include the ${name}. The most recent was reported on ${fmtDate(latest.date)}.</p>
${dnd || outside ? html`<div class="alert"><strong>Safety flags</strong>${dnd ? html`${plural(dnd, 'campaign')} marked “do not drive”. ` : ''}${outside ? html`${plural(outside, 'campaign')} advise parking outside until repaired. ` : ''}Check your VIN and follow the notice.</div>` : ''}
${lookupBox()}
${adSlot(env, 'vehicle-top')}
<section aria-labelledby="summary"><h2 id="summary">Recalls at a glance</h2>
<div class="table-wrap" style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Campaign</th><th>Part</th><th>Vehicles</th></tr></thead><tbody>${rows.map((r) => html`<tr><td>${fmtDate(r.date)}</td><td><a href="${campaignPath(r)}">${displayCampaign(r.campaign)}</a></td><td>${prettyComponent(r.component)}</td><td>${r.units ? r.units.toLocaleString('en-US') : '—'}</td></tr>`)}</tbody></table></div></section>
<section aria-labelledby="details"><h2 id="details">Recall details</h2>
${rows.map((r, i) => html`<article class="box"><h3><a href="${campaignPath(r)}">${prettyComponent(r.component)}</a> ${flags(r)}</h3><p class="meta">${fmtDate(r.date)} · ${r.manufacturer} · Campaign ${displayCampaign(r.campaign)}</p>
<p><strong>What is wrong:</strong> ${r.summary}</p>${r.consequence ? html`<p><strong>Risk:</strong> ${r.consequence}</p>` : ''}<p><strong>The fix:</strong> ${r.remedy}</p></article>${i === 1 ? adSlot(env, 'vehicle-mid') : ''}`)}</section>
${years.length > 1 ? html`<section aria-labelledby="years"><h2 id="years">Other model years of the ${row.make} ${row.model}</h2><div class="tags">${years.filter((y) => y.year !== year).map((y) => html`<a href="${vehiclePath(makeSlug, modelSlug, y.year)}">${y.year} (${y.n})</a>`)}</div></section>` : ''}
<p><a href="/cars/${makeSlug}/${modelSlug}/">All ${row.make} ${row.model} recalls</a> · <a href="/cars/${makeSlug}/">All ${row.make} recalls</a></p>
${faqBlock(faq)}
${adSlot(env, 'vehicle-bottom')}
${disclaimer()}`;

  return {
    meta: {
      title, description, path, nav: 'cars', index: isCarIndexable(row, env),
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, `${name} recalls`, rows.slice(0, 20).map((r) => ({ name: r.title, path: campaignPath(r) }))), faqLd(faq)],
    },
    body,
  };
}

// ---------- model page: Honda Accord ----------

export async function modelPage(env: Env, makeSlug: string, modelSlug: string, page: number): Promise<Page | null> {
  const years = await yearsForModel(env.DB, makeSlug, modelSlug);
  if (!years.length) return null;
  const { rows, total } = await recallsForModel(env.DB, makeSlug, modelSlug, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  if (!rows.length) return null;
  const make = years[0]!.make;
  const model = years[0]!.model;
  const base = `/cars/${makeSlug}/${modelSlug}/`;
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Car recalls', path: '/cars/' }, { name: make, path: `/cars/${makeSlug}/` }, { name: model, path: pagePath(base, page) }];
  const comps = topComponents(rows, 5);
  const most = [...years].sort((a, b) => b.n - a.n)[0]!;
  const faq = [
    { q: `How many recalls has the ${make} ${model} had?`, a: `NHTSA lists ${plural(total, 'recall campaign')} since ${FIRST_CAMPAIGN_YEAR} that include the ${make} ${model}, across ${plural(years.length, 'model year')} (${years[years.length - 1]!.year}–${years[0]!.year}).` },
    { q: `Which ${make} ${model} model year has the most recalls?`, a: `The ${most.year} ${make} ${model} appears in the most campaigns (${most.n}). Counts reflect how many recalls include that year, not how many cars were affected.` },
    { q: `How do I check my ${make} ${model} for recalls?`, a: 'Use the free VIN lookup at nhtsa.gov/recalls. A campaign applies only to certain vehicles, so a model-year match is not enough.' },
  ];
  return {
    meta: {
      title: page === 1 ? `${make} ${model} recalls by model year (${total} campaigns)` : `${make} ${model} recalls, page ${page}`,
      description: truncate(`${plural(total, 'NHTSA recall campaign')} for the ${make} ${model}, ${years.length} model years. Recalled parts include ${comps.slice(0, 3).map((c) => c.name.toLowerCase()).join(', ')}. Pick your year for details.`, 158),
      path: pagePath(base, page), nav: 'cars', index: page === 1 && years.length >= 2,
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, `${make} ${model} recalls`, rows.slice(0, 20).map((r) => ({ name: r.title, path: campaignPath(r) }))), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>${make} ${model} recalls</h1>
<p class="lede">${plural(total, 'recall campaign')} since ${FIRST_CAMPAIGN_YEAR} include the ${make} ${model}. Choose a model year to see only the recalls that cover it.</p>
${page === 1 ? html`<h2>By model year</h2><div class="tags">${years.map((y) => html`<a href="${vehiclePath(makeSlug, modelSlug, y.year)}">${y.year} (${plural(y.n, 'recall')})</a>`)}</div>
${comps.length ? html`<h2>Most recalled parts</h2><p>${comps.map((c) => `${c.name} (${c.n})`).join(', ')} among the latest campaigns.</p>` : ''}${lookupBox()}${adSlot(env, 'model-top')}` : ''}
<h2>${page === 1 ? 'Latest recalls' : `Recalls, page ${page}`}</h2>${recallList(rows)}${pagination(base, page, total)}${page === 1 ? faqBlock(faq) : ''}${disclaimer()}`,
  };
}

// ---------- make page: Honda ----------

export async function makePage(env: Env, makeSlug: string, page: number): Promise<Page | null> {
  const models = await modelsForMake(env.DB, makeSlug);
  if (!models.length) return null;
  const { rows, total } = await recallsForMake(env.DB, makeSlug, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  if (!rows.length) return null;
  const make = (await getCarPage(env.DB, makeSlug, models[0]!.model_slug, models[0]!.last_year))?.make ?? rows[0]!.manufacturer;
  const base = `/cars/${makeSlug}/`;
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Car recalls', path: '/cars/' }, { name: make, path: pagePath(base, page) }];
  const comps = topComponents(rows, 5);
  const faq = [
    { q: `How many ${make} recalls are there?`, a: `NHTSA lists ${plural(total, 'recall campaign')} since ${FIRST_CAMPAIGN_YEAR} for ${make} passenger vehicles, covering ${plural(models.length, 'model')}.` },
    { q: `Which ${make} models are recalled most often?`, a: `${models.slice(0, 3).map((m) => `${m.model} (${m.recalls})`).join(', ')} appear in the most campaigns.` },
    { q: `How do I check whether my ${make} is recalled?`, a: 'Use the free VIN lookup at nhtsa.gov/recalls, or contact a dealer with your VIN.' },
  ];
  return {
    meta: {
      title: page === 1 ? `${make} recalls: ${total} campaigns by model and year` : `${make} recalls, page ${page}`,
      description: truncate(`${plural(total, 'NHTSA recall campaign')} for ${make}: browse recalls by model and model year, see recalled parts and check your VIN.`, 158),
      path: pagePath(base, page), nav: 'cars', index: page === 1 && models.length >= 3,
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, `${make} models`, models.slice(0, 50).map((m) => ({ name: `${make} ${m.model}`, path: `/cars/${makeSlug}/${m.model_slug}/` }))), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>${make} recalls</h1>
<p class="lede">${plural(total, 'recall campaign')} since ${FIRST_CAMPAIGN_YEAR} for ${make} vehicles across ${plural(models.length, 'model')}.</p>
${page === 1 ? html`<h2>${make} models</h2><div class="table-wrap" style="overflow-x:auto"><table><thead><tr><th>Model</th><th>Model years</th><th>Recalls</th><th>Latest</th></tr></thead><tbody>${models.slice(0, 80).map((m) => html`<tr><td><a href="/cars/${makeSlug}/${m.model_slug}/">${m.model}</a></td><td>${m.first_year === m.last_year ? m.first_year : `${m.first_year}–${m.last_year}`}</td><td>${m.recalls}</td><td>${fmtDate(m.latest)}</td></tr>`)}</tbody></table></div>
${comps.length ? html`<h2>Most recalled parts (latest campaigns)</h2><p>${comps.map((c) => `${c.name} (${c.n})`).join(', ')}.</p>` : ''}${lookupBox()}${adSlot(env, 'make-top')}` : ''}
<h2>${page === 1 ? 'Latest recalls' : `Recalls, page ${page}`}</h2>${recallList(rows)}${pagination(base, page, total)}${page === 1 ? faqBlock(faq) : ''}${disclaimer()}`,
  };
}

// ---------- campaign page ----------

export async function campaignPage(env: Env, campaign: string, slug: string): Promise<Page | { redirect: string } | null> {
  const found = await getCampaign(env.DB, campaign.toUpperCase());
  if (!found) return null;
  const { recall: r, vehicles } = found;
  const canonicalSlug = campaignSlug(r);
  if (slug !== canonicalSlug) return { redirect: `/cars/recall/${canonicalSlug}/` };
  const path = campaignPath(r);
  const grouped = new Map<string, { make: string; model: string; makeSlug: string; modelSlug: string; years: number[] }>();
  for (const v of vehicles) {
    const key = `${v.make_slug}|${v.model_slug}`;
    const e = grouped.get(key) ?? { make: v.make, model: v.model, makeSlug: v.make_slug, modelSlug: v.model_slug, years: [] };
    e.years.push(v.year);
    grouped.set(key, e);
  }
  const groups = [...grouped.values()];
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Car recalls', path: '/cars/' }, { name: `Recall ${displayCampaign(r.campaign)}`, path }];
  const faq = [
    { q: 'Which vehicles are affected by this recall?', a: groups.slice(0, 6).map((g) => `${g.make} ${g.model} (${[...new Set(g.years)].sort().join(', ')})`).join('; ') + (groups.length > 6 ? '; and more' : '') + '. Check your VIN to confirm.' },
    { q: 'What is the safety risk?', a: r.consequence || sentence(r.summary, 1) },
    { q: 'What is the fix?', a: truncate(r.remedy, 420) },
  ];
  const description = truncate(`${r.title}. ${sentence(r.summary, 1)} NHTSA campaign ${displayCampaign(r.campaign)}, ${fmtDate(r.date)}: the risk, the fix and how to check your VIN.`, 158);
  return {
    meta: {
      title: truncate(r.title, 62) + ` (${displayCampaign(r.campaign)})`, description, path, nav: 'cars', index: isCarIndexable({ idx_rank: r.idx_rank }, env), ogType: 'article', published: r.date, modified: r.date,
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Article', headline: truncate(r.title, 110), description, datePublished: r.date, dateModified: r.date, mainEntityOfPage: abs(env, path), image: abs(env, '/og.png'), author: { '@type': 'Organization', name: env.SITE_NAME, url: abs(env, '/about/') }, publisher: { '@id': `${env.SITE_URL}/#organization` } },
        breadcrumbLd(env, crumbs), faqLd(faq),
      ],
    },
    body: html`${crumbsHtml(crumbs)}<article>
<h1>${r.title}</h1><p class="meta">NHTSA campaign ${displayCampaign(r.campaign)} · ${fmtDate(r.date)} · ${r.manufacturer} ${flags(r)}</p>
${r.do_not_drive || r.park_outside ? html`<div class="alert"><strong>Safety flag</strong>${r.do_not_drive ? 'NHTSA marked this recall “do not drive”. ' : ''}${r.park_outside ? 'The manufacturer advises parking outside until the repair is done. ' : ''}Check your VIN and follow the manufacturer’s notice.</div>` : ''}
${lookupBox()}
<section aria-labelledby="glance"><h2 id="glance">Recall at a glance</h2><div class="box"><dl class="facts"><dt>Campaign number</dt><dd>${r.campaign}</dd><dt>Reported</dt><dd>${fmtDate(r.date)}</dd><dt>Manufacturer</dt><dd>${r.manufacturer}</dd><dt>Part</dt><dd>${prettyComponent(r.component)}</dd>${r.units ? html`<dt>Vehicles affected</dt><dd>About ${r.units.toLocaleString('en-US')}</dd>` : ''}</dl></div></section>
${adSlot(env, 'campaign-top')}
<section aria-labelledby="problem"><h2 id="problem">What is wrong</h2><p>${r.summary}</p></section>
${r.consequence ? html`<section aria-labelledby="risk"><h2 id="risk">Safety risk</h2><p>${r.consequence}</p></section>` : ''}
<section aria-labelledby="fix"><h2 id="fix">The fix</h2><p>${r.remedy}</p></section>
<section aria-labelledby="models"><h2 id="models">Affected models</h2><p>Model years listed by NHTSA for this campaign. Only vehicles within the build range in the notice are affected.</p><ul>${groups.map((g) => html`<li><a href="/cars/${g.makeSlug}/${g.modelSlug}/">${g.make} ${g.model}</a>: ${[...new Set(g.years)].sort().map((y, i, a) => html`<a href="${vehiclePath(g.makeSlug, g.modelSlug, y)}">${y}</a>${i < a.length - 1 ? ', ' : ''}`)}</li>`)}</ul></section>
${r.notes ? html`<section aria-labelledby="notes"><h2 id="notes">Notes from the notice</h2><p>${r.notes}</p></section>` : ''}
${faqBlock(faq)}${adSlot(env, 'campaign-bottom')}${disclaimer()}</article>`,
  };
}

// ---------- hub and search ----------

export async function carsHome(env: Env): Promise<Page> {
  const [makes, latest] = await Promise.all([makesList(env.DB), latestCarRecalls(env.DB, 12)]);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Car recalls', path: '/cars/' }];
  const total = latest.total;
  const faq = [
    { q: 'How do I check whether my car has a recall?', a: 'Enter your 17-character VIN in NHTSA’s free lookup at nhtsa.gov/recalls. Browsing by make, model and year here shows which recalls exist, but only your VIN confirms whether yours is affected.' },
    { q: 'Are car recall repairs free?', a: 'In the recall notices listed here, the remedy usually states that dealers fix the problem free of charge. Read the remedy in the recall for the details.' },
    { q: 'Where does this recall information come from?', a: `It comes from NHTSA’s public recall data for passenger vehicles, recalls since ${FIRST_CAMPAIGN_YEAR}, updated automatically. ${env.SITE_NAME} is independent and not affiliated with NHTSA.` },
  ];
  return {
    meta: {
      title: 'Car recalls by make, model and year (NHTSA data)',
      description: `Browse ${plural(total, 'NHTSA vehicle recall campaign')} for cars, SUVs and trucks by make, model and model year. See what is recalled, the risk and the fix, and how to check your VIN.`,
      path: '/cars/', nav: 'cars', jsonLd: [breadcrumbLd(env, crumbs), faqLd(faq)],
    },
    body: html`${crumbsHtml(crumbs)}<h1>Car recalls</h1>
<p class="lede">Find recalls by make, model and model year, from NHTSA’s public data. ${plural(total, 'recall campaign')} since ${FIRST_CAMPAIGN_YEAR}.</p>
<form action="/cars/search/" method="get" role="search" class="hero" style="padding:0;border:0;background:none"><label for="cq" style="position:absolute;left:-999px">Search cars</label><input id="cq" name="q" type="search" placeholder="Try “Honda Accord 2018” or “F-150”" autocomplete="off" maxlength="60"><button type="submit">Search</button></form>
${lookupBox()}
${adSlot(env, 'cars-top')}
<h2>Browse by make</h2><ul class="cards">${makes.map((m) => html`<li><a class="card" href="/cars/${m.make_slug}/"><b>${m.make}</b><small>${plural(m.recalls, 'recall')} · ${plural(m.models, 'model')}</small></a></li>`)}</ul>
<h2>Latest car recalls</h2>${recallList(latest.rows)}
${faqBlock(faq)}${disclaimer()}`,
  };
}

export async function carsSearch(env: Env, q: string): Promise<Page> {
  const query = q.trim().slice(0, 60);
  const results: CarPageRow[] = query ? await searchCars(env.DB, query) : [];
  return {
    meta: { title: query ? `Car recall search: “${query}”` : 'Search car recalls', description: 'Search car recalls by make, model and model year.', path: '/cars/search/', index: false, nav: 'cars' },
    body: html`<h1>${query ? html`Car results for “${query}”` : 'Search car recalls'}</h1>
${query ? (results.length ? html`<ul class="list">${results.map((p) => html`<li><a class="t" href="${vehiclePath(p.make_slug, p.model_slug, p.year)}">${p.year} ${p.make} ${p.model}</a><br><small>${plural(p.n, 'recall')} · latest ${fmtDate(p.latest)}</small></li>`)}</ul>` : html`<p>No vehicles matched “${query}”. Try just the make, such as “Toyota”, or a model such as “Camry”.</p>`) : html`<p>Type a make, model or year, for example “2018 Honda Accord”.</p>`}
<p class="disclaimer">A vehicle without a listed recall is not guaranteed free of recalls. Check your VIN at <a href="${NHTSA_LOOKUP}" rel="noopener" target="_blank">nhtsa.gov/recalls</a>.</p>`,
  };
}

