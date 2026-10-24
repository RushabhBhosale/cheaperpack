import { html, type Html } from './html.ts';
import { adSlot } from './layout.ts';
import type { Page } from './pages.ts';
import { abs, breadcrumbLd, faqLd, itemListLd, type Crumb } from './seo.ts';
import type { Env } from './types.ts';

interface Guide {
  slug: string;
  title: string;
  description: string;
  intro: string;
  updated: string;
  sections: { h: string; body: Html }[];
  faq: { q: string; a: string }[];
  sources: { label: string; url: string }[];
}

const CPSC_HOTLINE = '(800) 638-2772';

export const GUIDES: Guide[] = [
  {
    slug: 'how-to-check-if-a-product-is-recalled',
    title: 'How to check if a product is recalled',
    description: 'Four ways to find out whether a product you own or plan to buy has been recalled in the US: search CPSC recalls, sign up for alerts, call the hotline and check secondhand items.',
    intro: 'Recalls are published by the U.S. Consumer Product Safety Commission (CPSC). Here is how to check quickly, and what to have on hand when you do.',
    updated: '2026-10-24',
    sections: [
      { h: 'Search the recall lists', body: html`<p>Search by brand or product name on this site, or on CPSC’s own <a href="https://www.cpsc.gov/Recalls" rel="noopener" target="_blank">recalls page</a>. Our <a href="/search/">search</a> covers every recall on record, and our <a href="/browse/">category and hazard pages</a> help if you are not sure of the exact name.</p>` },
      { h: 'Have the details ready', body: html`<p>Compare what is printed on the product with the recall: the brand, model or item number, date codes or batch numbers, colour, and where and when you bought it. A recall often covers only certain models or dates, so a name match alone does not mean your item is affected.</p>` },
      { h: 'Sign up for alerts', body: html`<p>CPSC runs an email subscription for recall alerts through <a href="https://www.recalls.gov/cpsc.html" rel="noopener" target="_blank">Recalls.gov</a>, so you hear about new recalls without searching. You can also follow this site’s <a href="/feed.xml">RSS feed</a> of the latest recalls.</p>` },
      { h: 'Call the CPSC hotline', body: html`<p>CPSC’s hotline can tell you whether a product has been recalled and take reports of unsafe products or injuries. The number is ${CPSC_HOTLINE}.</p>` },
      { h: 'Check secondhand and hand-me-down items', body: html`<p>Products you received secondhand or as hand-me-downs can be recalled too, and the original owner may never have seen the notice. Cribs, strollers, chargers and small appliances are worth a check before you use them.</p>` },
      { h: 'Report a product you think is unsafe', body: html`<p>If a product caused harm or could be dangerous, you can report it at <a href="https://www.saferproducts.gov/" rel="noopener" target="_blank">SaferProducts.gov</a>. CPSC publishes those reports, and searching them can also show whether products you own or are considering buying may pose a risk.</p>` },
    ],
    faq: [
      { q: 'Do recalls expire?', a: 'Recalls usually have no end date, so it is worth acting on an old recall if you learn about it late. Follow the instructions in the notice.' },
      { q: 'Is a product safe if I cannot find a recall?', a: 'Not necessarily. A missing recall only means none was found under that name. New recalls are announced regularly, so check again if you have doubts or use alerts.' },
    ],
    sources: [
      { label: 'CPSC: Recalls and product safety warnings', url: 'https://www.cpsc.gov/Recalls' },
      { label: 'Recalls.gov: Consumer product recalls', url: 'https://www.recalls.gov/cpsc.html' },
      { label: 'SaferProducts.gov', url: 'https://www.saferproducts.gov/' },
    ],
  },
  {
    slug: 'what-to-do-with-a-recalled-product',
    title: 'What to do if you own a recalled product',
    description: 'Stop using it, read the remedy, contact the company and escalate to CPSC if needed. A plain-English guide to refunds, repairs and replacements for recalled products.',
    intro: 'Finding out that something you own is recalled is stressful. The steps are usually simple, and the recall notice tells you exactly which ones apply.',
    updated: '2026-10-24',
    sections: [
      { h: '1. Stop using it, unless the notice says otherwise', body: html`<p>CPSC’s guidance is that you should typically stop using a recalled product and follow the instructions in its recall announcement. Read the hazard description first so you understand the risk.</p>` },
      { h: '2. Read the remedy', body: html`<p>There is no single remedy. It is usually a refund, a repair or a replacement, and the notice spells out which one applies and how to claim it. Each recall page on this site shows the remedy and links to the official notice.</p>` },
      { h: '3. Contact the company first', body: html`<p>The notice lists a toll-free number and website for the company. Many notices ask you to take a photo, mark the product as recalled or confirm that you have disposed of it. A receipt is not always required. Follow the notice exactly, because some tell you not to repair the product yourself.</p>` },
      { h: '4. Escalate if the company does not respond', body: html`<p>If the company does not resolve it, you can contact CPSC at ${CPSC_HOTLINE} or through its contact form. CPSC also has a form for problems with a recall remedy or a company that is not responding.</p>` },
      { h: '5. Report what happened', body: html`<p>If you were hurt or had a close call, report it at <a href="https://www.saferproducts.gov/" rel="noopener" target="_blank">SaferProducts.gov</a>. Reports help CPSC spot problems.</p>` },
    ],
    faq: [
      { q: 'Can I still get a remedy for an old recall?', a: 'Often yes. Recalls usually have no end date, so follow the notice anyway. Whether a company still honours an old remedy depends on the notice, so contact it and, if needed, CPSC.' },
      { q: 'Should I throw a recalled product away?', a: 'Only if the notice says to. Some remedies require you to send the product back, others to show proof of disposal. Disposing of it early can make a refund harder to claim.' },
    ],
    sources: [
      { label: 'CPSC: Recalls and product safety warnings', url: 'https://www.cpsc.gov/Recalls' },
      { label: 'CPSC: Hotline questions and answers', url: 'https://www.cpsc.gov/Business--Manufacturing/Recall-Guidance/Hotline-Questions-and-Answers' },
      { label: 'SaferProducts.gov', url: 'https://www.saferproducts.gov/' },
    ],
  },
  {
    slug: 'e-bike-scooter-battery-charging-safety',
    title: 'E-bike, scooter and hoverboard battery charging safety',
    description: 'CPSC’s charging advice for e-bike, e-scooter and hoverboard batteries: do not charge overnight, use the right charger, avoid modified packs and dispose of batteries correctly.',
    intro: 'Lithium-ion batteries power e-bikes, e-scooters and hoverboards, and many recalls in these categories involve fire. This guide summarises CPSC’s published charging advice.',
    updated: '2026-10-24',
    sections: [
      { h: 'Do not charge overnight or while you are away', body: html`<p>CPSC reports that many home fires and deaths happen at night while batteries charge and people sleep. Its advice is to avoid charging overnight or when you are not home, to stay nearby while charging and to unplug the charger when the battery is full.</p>` },
      { h: 'Use the right charger', body: html`<p>Use the charger that came with the device or one the manufacturer recommends. CPSC has warned against “universal” e-bike chargers that are not compatible with a specific battery, because even a good battery can start a fire with the wrong charger.</p>` },
      { h: 'Be careful with replacement batteries', body: html`<p>Replacement batteries should be approved for your device. CPSC advises against battery packs that were modified by unqualified people or built with used cells.</p>` },
      { h: 'Stop using a damaged or recalled battery', body: html`<p>If a battery is damaged or CPSC issues a recall or warning for it, follow that notice. For example, CPSC’s warning for certain Rad Power Bikes e-bike batteries told owners to remove the battery immediately and dispose of it through hazardous waste channels. Check <a href="/category/e-bikes-scooters/">e-bike and scooter recalls</a> and <a href="/category/power-banks-chargers/">battery and charger recalls</a>.</p>` },
      { h: 'Dispose of lithium batteries properly', body: html`<p>Do not put lithium batteries in household trash or recycling. CPSC says to take them to a local battery recycler or hazardous waste collection centre.</p>` },
    ],
    faq: [
      { q: 'Does this advice apply to power banks and phone chargers?', a: 'CPSC’s published guidance on this topic is aimed at e-bikes, e-scooters and hoverboards. For any product, the safest step is to follow its manufacturer’s instructions and check the recall list for your brand.' },
      { q: 'What should I do if my battery gets hot or swells?', a: 'Stop using and charging it and follow the manufacturer’s instructions. If you think it is a fire risk, contact the manufacturer and consider reporting it at SaferProducts.gov.' },
    ],
    sources: [
      { label: 'CPSC: Micromobility information center', url: 'https://www.cpsc.gov/Safety-Education/Safety-Education-Centers/Micromobility-Information-Center' },
      { label: 'CPSC: Statement on “universal” e-bike chargers', url: 'https://www.cpsc.gov/About-CPSC/Commissioner/Richard-Trumka/Statement/Commissioner-Trumka-Urges-Consumers-Not-to-Use-%E2%80%9CUniversal%E2%80%9D-Chargers-for-E-bikes-Because-of-Fire-Hazard' },
      { label: 'CPSC warning: Rad Power Bikes e-bike batteries', url: 'https://www.cpsc.gov/Warnings/2026/CPSC-Warns-Consumers-to-Immediately-Stop-Using-Batteries-for-E-Bikes-from-Rad-Power-Bikes-Due-to-Fire-Hazard-Risk-of-Serious-Injury-or-Death' },
    ],
  },
];

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);

export function guidesIndex(env: Env): Page {
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }];
  return {
    meta: {
      title: 'Product recall guides: check, act and stay safe',
      description: 'Plain-English guides to checking whether a product is recalled, what to do if you own one and charging safety for e-bike and scooter batteries.',
      path: '/guides/', nav: 'guides',
      jsonLd: [breadcrumbLd(env, crumbs), itemListLd(env, 'Recall guides', GUIDES.map((g) => ({ name: g.title, path: `/guides/${g.slug}/` })))],
    },
    body: html`<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Guides</span></nav><h1>Recall guides</h1><p class="lede">Short, sourced guides based on CPSC’s published advice.</p>
<ul class="cards">${GUIDES.map((g) => html`<li><a class="card" href="/guides/${g.slug}/"><b>${g.title}</b><p>${g.description}</p></a></li>`)}</ul>`,
  };
}

export function guidePage(env: Env, g: Guide): Page {
  const path = `/guides/${g.slug}/`;
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: g.title, path }];
  return {
    meta: {
      title: g.title, description: g.description, path, nav: 'guides', ogType: 'article', published: g.updated, modified: g.updated,
      jsonLd: [
        {
          '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, datePublished: g.updated, dateModified: g.updated,
          mainEntityOfPage: abs(env, path), image: abs(env, '/og.png'), author: { '@type': 'Organization', name: env.SITE_NAME, url: abs(env, '/about/') },
          publisher: { '@id': `${env.SITE_URL}/#organization` }, citation: g.sources.map((s) => s.url),
        },
        breadcrumbLd(env, crumbs), faqLd(g.faq),
      ],
    },
    body: html`<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/guides/">Guides</a> / <span aria-current="page">${g.title}</span></nav>
<article class="prose"><h1>${g.title}</h1><p class="meta">Reviewed ${g.updated}</p><p class="lede">${g.intro}</p>
${g.sections.map((s, i) => html`<h2>${s.h}</h2>${s.body}${i === 1 ? adSlot(env, 'guide-mid') : ''}`)}
<h2>Common questions</h2>${g.faq.map((f) => html`<details><summary>${f.q}</summary><p>${f.a}</p></details>`)}
<h2>Sources</h2><ul>${g.sources.map((s) => html`<li><a href="${s.url}" rel="noopener" target="_blank">${s.label}</a></li>`)}</ul>
<p class="disclaimer">This guide summarises public CPSC advice and is not a substitute for the instructions in a specific recall notice or from a product’s manufacturer.</p></article>`,
  };
}

// ---------- about, privacy, terms, contact ----------

export function staticPage(env: Env, name: 'about' | 'privacy' | 'terms' | 'contact'): Page | null {
  const crumb = (label: string, path: string): Crumb[] => [{ name: 'Home', path: '/' }, { name: label, path }];
  const wrap = (label: string, path: string, desc: string, content: Html, title = `${label} | ${env.SITE_NAME}`): Page => ({
    meta: { title, description: desc, path, jsonLd: [breadcrumbLd(env, crumb(label, path))] },
    body: html`<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">${label}</span></nav><article class="prose"><h1>${label}</h1>${content}</article>`,
  });
  const site = env.SITE_NAME;
  switch (name) {
    case 'about':
      return wrap('About and methodology', '/about/', `How ${site} gets its recall data, how often it updates, what we add and what we leave out.`, html`
<p>${site} helps people check whether a consumer product has been recalled in the United States. It is an independent site. It is not affiliated with, endorsed by or operated by the U.S. Consumer Product Safety Commission (CPSC).</p>
<h2>Where the data comes from</h2><p>Every recall comes from the public recall data CPSC publishes. The site checks for new and updated recalls twice a day and refreshes its pages automatically. Each recall page links to the official CPSC notice, which is always the authority.</p>
<h2>What we add</h2><ul><li>Recalls grouped by <a href="/browse/">category and hazard type</a>, and by <a href="/brands/">brand</a>, with counts and history.</li><li>A plain summary of what to do, the products affected and where they were sold.</li><li>Related recalls from the same brand and category.</li><li>Short <a href="/guides/">guides</a> summarising CPSC’s published advice.</li></ul>
<h2>How categories and hazards are assigned</h2><p>CPSC’s recall records do not always include a product category, so we assign one automatically from the product name, and we assign hazard types from the hazard text. These labels are a convenience for browsing and can occasionally be wrong. They never replace the notice.</p>
<h2>What we do not do</h2><ul><li>We do not give medical, legal or safety advice. Follow the manufacturer’s and CPSC’s instructions.</li><li>We do not guarantee that a product without a recall here is safe. A recall may be too new, or may use different wording.</li><li>We do not sell recalled products.</li></ul>
<h2>Corrections</h2><p>If a page disagrees with the official notice, trust the notice. See the <a href="/contact/">contact page</a> to report an error.</p>`);
    case 'privacy':
      return wrap('Privacy policy', '/privacy/', `What data ${site} collects, how cookies and advertising work and your choices.`, html`
<p>Last updated 24 October 2026.</p>
<h2>What we collect</h2><p>${site} has no accounts, no sign-up and no comments. We do not ask for personal information. Our hosting provider, Cloudflare, processes standard request data such as IP address and browser type to deliver the site and keep it secure.</p>
<h2>Search</h2><p>Words you type in the search box are used to find matching recalls. We do not build profiles from searches.</p>
<h2>Analytics</h2><p>If analytics is enabled, we use Google Analytics to understand which pages are useful. It may set cookies and collect usage data such as pages viewed and approximate location. You can block it with browser settings or the <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener" target="_blank">Google Analytics opt-out add-on</a>.</p>
<h2>Advertising</h2><p>When advertising is enabled, we use Google AdSense. Google and its partners may use cookies and similar technologies to show ads, including personalised ads based on your visits to this and other sites. You can manage personalised advertising at <a href="https://adssettings.google.com" rel="noopener" target="_blank">Google Ads Settings</a> or opt out of some third-party vendors at <a href="https://www.aboutads.info" rel="noopener" target="_blank">aboutads.info</a>. Visitors in the European Economic Area, the United Kingdom and Switzerland are asked for consent where the law requires it.</p>
<h2>External links and images</h2><p>Recall pages link to cpsc.gov and may show photos hosted by CPSC. Those sites have their own privacy practices.</p>
<h2>Children</h2><p>The site is not directed at children under 13 and does not knowingly collect their personal information.</p>
<h2>Changes</h2><p>We may update this policy and will change the date above when we do.</p>`);
    case 'terms':
      return wrap('Terms and disclaimer', '/terms/', `Terms of use and important disclaimers for ${site}: recall information is provided for general information and the official CPSC notice is always the authority.`, html`
<h2>Information only</h2><p>${site} provides recall information for general information. It is not safety, legal or professional advice. Always read the official CPSC notice and follow the instructions from the manufacturer or seller.</p>
<h2>Accuracy</h2><p>Recall data comes from CPSC and is shown as published. We work to keep it current, but recalls can change and we cannot guarantee that every recall is listed, complete or up to date. If a page disagrees with the official notice, the notice is correct.</p>
<h2>No affiliation</h2><p>${site} is independent. It is not affiliated with, endorsed by or operated by CPSC or any manufacturer, retailer or government body. Names and brands belong to their owners and appear only to identify recalled products.</p>
<h2>Liability</h2><p>To the fullest extent permitted by law, ${site} is provided “as is” and we are not liable for loss or damage arising from use of, or reliance on, the information here.</p>
<h2>Use of the site</h2><p>You may link to any page. Do not misuse the site, for example by overloading it with automated requests.</p>`);
    case 'contact':
      return wrap('Contact', '/contact/', `How to contact ${site} to report an error or ask a question about a recall page, plus where to report an unsafe product to CPSC.`, html`
<p>To report an error, ask a question or send a correction, email us${env.CONTACT_EMAIL ? html` at <a href="mailto:${env.CONTACT_EMAIL}">${env.CONTACT_EMAIL}</a>` : ' using the address that will appear on this page'}. Please include the page address and what looks wrong.</p>
<h2>Need to report an unsafe product?</h2><p>Report it to CPSC at <a href="https://www.saferproducts.gov/" rel="noopener" target="_blank">SaferProducts.gov</a> or call the CPSC hotline at ${CPSC_HOTLINE}. We cannot take product safety reports or arrange refunds.</p>
<h2>Need help with a recalled product?</h2><p>Follow the official notice linked on the recall page. Our guide <a href="/guides/what-to-do-with-a-recalled-product/">What to do if you own a recalled product</a> explains the steps.</p>`);
  }
}

export const sitemapStaticPaths = ['/', '/recalls/', '/browse/', '/brands/', '/guides/', ...GUIDES.map((g) => `/guides/${g.slug}/`), '/about/', '/contact/', '/privacy/', '/terms/'];
