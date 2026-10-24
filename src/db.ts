import { HOURS, memo } from './memo.ts';
import type { Recall } from './types.ts';

/** Light row used for lists (no full JSON payload). */
export interface RecallCard {
  number: string;
  slug: string;
  date: string;
  short_title: string;
  snippet: string;
  brand: string;
  brand_slug: string;
  category: string;
  hazards: string;
  quality: number;
  eligible: number;
  idx_rank: number | null;
}

const CARD_COLS = 'number, slug, date, short_title, snippet, brand, brand_slug, category, hazards, quality, eligible, idx_rank';

export const snippetOf = (description: string, max = 170): string => {
  if (description.length <= max) return description;
  const cut = description.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[\s,;:-]+$/, '')}…`;
};

const searchText = (r: Recall) => `${r.short_title} ${r.brand} ${r.products.map((p) => `${p.name} ${p.model}`).join(' ')}`.toLowerCase();

export function upsertStatement(db: D1Database, r: Recall, isNew: boolean): D1PreparedStatement {
  // Backfilled rows get a stable drip rank (set by the backfill). A recall first seen after
  // launch is always indexable (rank 0) and never changes rank afterwards.
  const rank = r.idx_rank ?? (isNew ? 0 : null);
  return db
    .prepare(
      `INSERT INTO recalls (id, number, slug, date, last_publish, short_title, snippet, brand, brand_slug, category, hazards, quality, eligible, idx_rank, search_text, data)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
       ON CONFLICT(id) DO UPDATE SET number=excluded.number, slug=excluded.slug, date=excluded.date, last_publish=excluded.last_publish,
         short_title=excluded.short_title, snippet=excluded.snippet, brand=excluded.brand, brand_slug=excluded.brand_slug, category=excluded.category,
         hazards=excluded.hazards, quality=excluded.quality, eligible=excluded.eligible, search_text=excluded.search_text, data=excluded.data,
         idx_rank=COALESCE(recalls.idx_rank, excluded.idx_rank, CASE WHEN excluded.eligible = 1 THEN 0 END)`,
    )
    .bind(r.id, r.number, r.slug, r.date, r.last_publish, r.short_title, snippetOf(r.description), r.brand, r.brand_slug, r.category, `|${r.hazards.join('|')}|`, r.quality, r.eligible ? 1 : 0, rank, searchText(r), JSON.stringify(r));
}

export async function existingIds(db: D1Database, ids: number[]): Promise<Set<number>> {
  const found = new Set<number>();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { results } = await db.prepare(`SELECT id FROM recalls WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all<{ id: number }>();
    for (const row of results) found.add(row.id);
  }
  return found;
}

export async function getMeta(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export function setMetaStatement(db: D1Database, key: string, value: string) {
  return db.prepare('INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value);
}

export async function getRecallByNumber(db: D1Database, number: string): Promise<Recall | null> {
  const row = await db.prepare('SELECT data, idx_rank FROM recalls WHERE number = ?').bind(number).first<{ data: string; idx_rank: number | null }>();
  if (!row) return null;
  const r = JSON.parse(row.data) as Recall;
  r.idx_rank = row.idx_rank;
  return r;
}

type Filter = { where: string; params: (string | number)[] };

const filterSql = (f: Filter) => (f.where ? `WHERE ${f.where}` : '');

export async function listCards(db: D1Database, f: Filter, limit: number, offset: number): Promise<RecallCard[]> {
  const { results } = await db
    .prepare(`SELECT ${CARD_COLS} FROM recalls ${filterSql(f)} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...f.params, limit, offset)
    .all<RecallCard>();
  return results;
}

export async function countCards(db: D1Database, f: Filter): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM recalls ${filterSql(f)}`).bind(...f.params).first<{ n: number }>();
  return row?.n ?? 0;
}

export const filters = {
  all: (): Filter => ({ where: '', params: [] }),
  category: (slug: string): Filter => ({ where: 'category = ?', params: [slug] }),
  brand: (slug: string): Filter => ({ where: 'brand_slug = ?', params: [slug] }),
  hazard: (slug: string): Filter => ({ where: 'hazards LIKE ?', params: [`%|${slug}|%`] }),
  recent: (): Filter => ({ where: 'date >= ?', params: [new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)] }),
};

export async function searchCards(db: D1Database, q: string, limit = 40): Promise<RecallCard[]> {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!terms.length) return [];
  const where = terms.map(() => 'search_text LIKE ?').join(' AND ');
  const { results } = await db
    .prepare(`SELECT ${CARD_COLS} FROM recalls WHERE ${where} ORDER BY date DESC, id DESC LIMIT ?`)
    .bind(...terms.map((t) => `%${t.replace(/[%_]/g, '')}%`), limit)
    .all<RecallCard>();
  return results;
}

export interface Group { key: string; name: string; n: number; eligible: number; latest: string }

export async function groupBy(db: D1Database, column: 'category' | 'brand_slug', minEligible = 0): Promise<Group[]> {
  return memo(db, `groupBy:${column}:${minEligible}`, 6 * HOURS, async () => {
    const { results } = await db
      .prepare(`SELECT ${column} AS key, MAX(brand) AS name, COUNT(*) AS n, SUM(eligible) AS eligible, MAX(date) AS latest FROM recalls WHERE ${column} != '' GROUP BY ${column} HAVING SUM(eligible) >= ? ORDER BY n DESC`)
      .bind(minEligible)
      .all<Group>();
    return results;
  });
}

/** Recall counts per hazard in one table scan (cached). */
export async function hazardCounts(db: D1Database, slugs: string[], eligibleOnly = false): Promise<Record<string, number>> {
  return memo(db, `hazardCounts:${eligibleOnly}:${slugs.join(',')}`, 6 * HOURS, async () => {
    const cols = slugs.map((_, i) => `COALESCE(SUM(hazards LIKE ?${i + 1}), 0) AS c${i}`).join(', ');
    const row = await db.prepare(`SELECT ${cols} FROM recalls${eligibleOnly ? ' WHERE eligible = 1' : ''}`).bind(...slugs.map((s) => `%|${s}|%`)).first<Record<string, number>>();
    return Object.fromEntries(slugs.map((s, i) => [s, Number(row?.[`c${i}`] ?? 0)]));
  });
}

/** How many recalls of one hazard sit in each category (one scan, cached). */
export async function hazardByCategory(db: D1Database, slug: string): Promise<{ category: string; n: number }[]> {
  return memo(db, `hazardByCategory:${slug}`, 6 * HOURS, async () => {
    const { results } = await db.prepare('SELECT category, COUNT(*) AS n FROM recalls WHERE hazards LIKE ? GROUP BY category ORDER BY n DESC').bind(`%|${slug}|%`).all<{ category: string; n: number }>();
    return results;
  });
}

export const totalRecalls = (db: D1Database) => memo(db, 'totalRecalls', 3 * HOURS, () => countCards(db, filters.all()));

export async function brandName(db: D1Database, slug: string): Promise<string | null> {
  const row = await db.prepare('SELECT brand FROM recalls WHERE brand_slug = ? ORDER BY date DESC LIMIT 1').bind(slug).first<{ brand: string }>();
  return row?.brand ?? null;
}

export interface SitemapRow { number: string; slug: string; last_publish: string; date: string; idx_rank: number | null }

/** Recalls that are allowed into the index today (see seo.ts → indexBudget). */
export async function indexableRows(db: D1Database, budget: number): Promise<SitemapRow[]> {
  const { results } = await db
    .prepare('SELECT number, slug, last_publish, date, idx_rank FROM recalls WHERE eligible = 1 AND (idx_rank = 0 OR idx_rank <= ?) ORDER BY date DESC, id DESC')
    .bind(budget)
    .all<SitemapRow>();
  return results;
}

export async function relatedCards(db: D1Database, r: Recall, limit = 6): Promise<{ brand: RecallCard[]; category: RecallCard[] }> {
  const brand = r.brand_slug
    ? (await db.prepare(`SELECT ${CARD_COLS} FROM recalls WHERE brand_slug = ?1 AND number != ?2 ORDER BY date DESC LIMIT ?3`).bind(r.brand_slug, r.number, limit).all<RecallCard>()).results
    : [];
  const category = (await db.prepare(`SELECT ${CARD_COLS} FROM recalls WHERE category = ?1 AND number != ?2 AND eligible = 1 ORDER BY date DESC LIMIT ?3`).bind(r.category, r.number, limit + 2).all<RecallCard>()).results
    .filter((c) => !brand.some((b) => b.number === c.number))
    .slice(0, limit);
  return { brand, category };
}

export async function categoryStats(db: D1Database, category: string, sinceYear = 2019): Promise<{ total: number; lastYear: number }> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) AS lastYear FROM recalls WHERE category = ? AND date >= ?`)
    .bind(new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10), category, `${sinceYear}-01-01`)
    .first<{ total: number; lastYear: number }>();
  return { total: row?.total ?? 0, lastYear: row?.lastYear ?? 0 };
}
