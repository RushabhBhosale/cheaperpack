import { esc, jsonScript, raw, truncate, type Html } from './html.ts';
import type { Env, Recall } from './types.ts';

export const abs = (env: Env, path: string) => new URL(path, env.SITE_URL).href;

/**
 * Indexing schedule for the backlog (recalls from 2019 onward that existed when the site launched).
 * The newest 150 are allowed in on day one and 40 more each day after. Recalls first seen after
 * launch are always allowed (rank 0). Ranks never change, so a page that has been allowed in
 * is never switched back to noindex.
 */
export function indexBudget(env: Env, now = new Date()): number {
  const launch = new Date(`${env.LAUNCH_DATE}T00:00:00Z`).getTime();
  const days = Math.max(0, Math.floor((now.getTime() - launch) / 86400000));
  return 150 + 40 * days;
}

export function isIndexable(r: Pick<Recall, 'eligible' | 'idx_rank'>, env: Env, now = new Date()): boolean {
  if (!r.eligible || r.idx_rank === null || r.idx_rank === undefined) return false;
  return r.idx_rank === 0 || r.idx_rank <= indexBudget(env, now);
}

export interface Crumb { name: string; path: string }

export const breadcrumbLd = (env: Env, crumbs: Crumb[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(env, c.path) })),
});

export const faqLd = (items: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

export const itemListLd = (env: Env, name: string, items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  numberOfItems: items.length,
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: abs(env, it.path) })),
});

export const organizationLd = (env: Env) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${env.SITE_URL}/#organization`,
  name: env.SITE_NAME,
  url: `${env.SITE_URL}/`,
  logo: abs(env, '/apple-touch-icon.png'),
});

export const websiteLd = (env: Env) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${env.SITE_URL}/#website`,
  name: env.SITE_NAME,
  url: `${env.SITE_URL}/`,
  publisher: { '@id': `${env.SITE_URL}/#organization` },
  potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${env.SITE_URL}/search/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
});

export const ldScripts = (items: unknown[]): Html => raw(items.map((d) => `<script type="application/ld+json">${jsonScript(d)}</script>`).join(''));

export const metaDescription = (s: string) => esc(truncate(s.replace(/\s+/g, ' ').trim(), 160));
