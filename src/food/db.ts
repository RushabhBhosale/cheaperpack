import { truncate } from '../html.ts';
import { getMeta, setMetaStatement } from '../db.ts';
import { foodHazardInfo, type FoodEvent } from './derive.ts';

export interface FoodCard {
  event_id: string;
  slug: string;
  report_date: string;
  firm: string;
  firm_slug: string;
  classification: string;
  status: string;
  title: string;
  snippet: string;
  category: string;
  hazards: string;
  eligible: number;
  idx_rank: number | null;
}

const CARD_COLS = 'event_id, slug, report_date, firm, firm_slug, classification, status, title, snippet, category, hazards, eligible, idx_rank';

export const foodSnippet = (e: FoodEvent) => truncate(`${e.reason}${e.products[0] ? ` Product: ${e.products[0].description}` : ''}`, 190);
const searchText = (e: FoodEvent) => `${e.title} ${e.firm} ${e.products.map((p) => p.description).join(' ')}`.toLowerCase().slice(0, 4000);

export function upsertFoodStatement(db: D1Database, e: FoodEvent, isNew: boolean): D1PreparedStatement {
  const rank = e.idxRank ?? (isNew ? 0 : null);
  return db
    .prepare(
      `INSERT INTO food_recalls (event_id, slug, report_date, firm, firm_slug, classification, status, title, snippet, category, hazards, chars, eligible, idx_rank, search_text, data)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
       ON CONFLICT(event_id) DO UPDATE SET slug=excluded.slug, report_date=excluded.report_date, firm=excluded.firm, firm_slug=excluded.firm_slug, classification=excluded.classification,
         status=excluded.status, title=excluded.title, snippet=excluded.snippet, category=excluded.category, hazards=excluded.hazards, chars=excluded.chars, eligible=excluded.eligible,
         search_text=excluded.search_text, data=excluded.data, idx_rank=COALESCE(food_recalls.idx_rank, excluded.idx_rank, CASE WHEN excluded.eligible = 1 THEN 0 END)`,
    )
    .bind(e.eventId, e.slug, e.reportDate, e.firm, e.firmSlug, e.classification, e.status, e.title, foodSnippet(e), e.category, `|${e.hazards.join('|')}|`, e.chars, e.eligible ? 1 : 0, rank, searchText(e), JSON.stringify(e));
}

export async function knownFoodEvents(db: D1Database, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { results } = await db.prepare(`SELECT event_id FROM food_recalls WHERE event_id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all<{ event_id: string }>();
    for (const r of results) found.add(r.event_id);
  }
  return found;
}

export { getMeta, setMetaStatement };

export async function getFoodEvent(db: D1Database, eventId: string): Promise<(FoodEvent & { idxRank: number | null; eligible: boolean }) | null> {
  const row = await db.prepare('SELECT data, idx_rank, eligible FROM food_recalls WHERE event_id = ?').bind(eventId).first<{ data: string; idx_rank: number | null; eligible: number }>();
  if (!row) return null;
  const e = JSON.parse(row.data) as FoodEvent;
  return { ...e, idxRank: row.idx_rank, eligible: row.eligible === 1 };
}

type Filter = { where: string; params: (string | number)[] };
const w = (f: Filter) => (f.where ? `WHERE ${f.where}` : '');

export const foodFilters = {
  all: (): Filter => ({ where: '', params: [] }),
  category: (slug: string): Filter => ({ where: 'category = ?', params: [slug] }),
  hazard: (slug: string): Filter => ({ where: 'hazards LIKE ?', params: [`%|${slug}|%`] }),
  firm: (slug: string): Filter => ({ where: 'firm_slug = ?', params: [slug] }),
};

export async function listFood(db: D1Database, f: Filter, limit: number, offset: number): Promise<FoodCard[]> {
  const { results } = await db.prepare(`SELECT ${CARD_COLS} FROM food_recalls ${w(f)} ORDER BY report_date DESC, event_id DESC LIMIT ? OFFSET ?`).bind(...f.params, limit, offset).all<FoodCard>();
  return results;
}

export async function countFood(db: D1Database, f: Filter): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM food_recalls ${w(f)}`).bind(...f.params).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function searchFood(db: D1Database, q: string, limit = 40): Promise<FoodCard[]> {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!terms.length) return [];
  const where = terms.map(() => 'search_text LIKE ?').join(' AND ');
  const { results } = await db.prepare(`SELECT ${CARD_COLS} FROM food_recalls WHERE ${where} ORDER BY report_date DESC LIMIT ?`).bind(...terms.map((t) => `%${t.replace(/[%_]/g, '')}%`), limit).all<FoodCard>();
  return results;
}

export interface FoodGroup { key: string; name: string; n: number; eligible: number; latest: string }

export async function foodGroups(db: D1Database, column: 'category' | 'firm_slug', minEligible = 0): Promise<FoodGroup[]> {
  const { results } = await db
    .prepare(`SELECT ${column} AS key, MAX(firm) AS name, COUNT(*) AS n, SUM(eligible) AS eligible, MAX(report_date) AS latest FROM food_recalls WHERE ${column} != '' GROUP BY ${column} HAVING SUM(eligible) >= ? ORDER BY n DESC`)
    .bind(minEligible)
    .all<FoodGroup>();
  return results;
}

export async function foodHazardCounts(db: D1Database, slugs: string[], eligibleOnly = false): Promise<Record<string, number>> {
  const rows = await Promise.all(slugs.map((s) => db.prepare(`SELECT COUNT(*) AS n FROM food_recalls WHERE hazards LIKE ?${eligibleOnly ? ' AND eligible = 1' : ''}`).bind(`%|${s}|%`).first<{ n: number }>()));
  return Object.fromEntries(slugs.map((s, i) => [s, rows[i]?.n ?? 0]));
}

export async function firmName(db: D1Database, slug: string): Promise<string | null> {
  const row = await db.prepare('SELECT firm FROM food_recalls WHERE firm_slug = ? ORDER BY report_date DESC LIMIT 1').bind(slug).first<{ firm: string }>();
  return row?.firm ?? null;
}

export async function relatedFood(db: D1Database, e: { eventId: string; firmSlug: string; category: string }, limit = 6): Promise<{ firm: FoodCard[]; category: FoodCard[] }> {
  const firm = e.firmSlug ? (await db.prepare(`SELECT ${CARD_COLS} FROM food_recalls WHERE firm_slug = ?1 AND event_id != ?2 ORDER BY report_date DESC LIMIT ?3`).bind(e.firmSlug, e.eventId, limit).all<FoodCard>()).results : [];
  const category = (await db.prepare(`SELECT ${CARD_COLS} FROM food_recalls WHERE category = ?1 AND event_id != ?2 AND eligible = 1 ORDER BY report_date DESC LIMIT ?3`).bind(e.category, e.eventId, limit + 2).all<FoodCard>()).results
    .filter((c) => !firm.some((f) => f.event_id === c.event_id)).slice(0, limit);
  return { firm, category };
}

export async function foodSitemapRows(db: D1Database, budget: number): Promise<{ events: { slug: string; report_date: string }[]; firms: { firm_slug: string; latest: string }[]; categories: { category: string; latest: string }[]; hazardLatest: string }> {
  const [events, firms, cats, latest] = await Promise.all([
    db.prepare('SELECT slug, report_date FROM food_recalls WHERE eligible = 1 AND (idx_rank = 0 OR idx_rank <= ?) ORDER BY report_date DESC').bind(budget).all<{ slug: string; report_date: string }>(),
    db.prepare('SELECT firm_slug, MAX(report_date) AS latest FROM food_recalls WHERE eligible = 1 AND firm_slug != \'\' GROUP BY firm_slug HAVING COUNT(*) >= 3').all<{ firm_slug: string; latest: string }>(),
    db.prepare('SELECT category, MAX(report_date) AS latest FROM food_recalls WHERE eligible = 1 GROUP BY category HAVING COUNT(*) >= 8').all<{ category: string; latest: string }>(),
    db.prepare('SELECT MAX(report_date) AS d FROM food_recalls').first<{ d: string }>(),
  ]);
  return { events: events.results, firms: firms.results, categories: cats.results, hazardLatest: latest?.d ?? '' };
}

export const hazardName = (slug: string) => foodHazardInfo(slug)?.name ?? slug;
