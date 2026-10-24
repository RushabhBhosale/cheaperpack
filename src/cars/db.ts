import { HOURS, memo } from '../memo.ts';
import { FIRST_PAGE_MODEL_YEAR, campaignTitle, type CarCampaign } from './derive.ts';

export interface CarRecallRow {
  campaign: string;
  date: string;
  manufacturer: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  notes: string;
  units: number | null;
  do_not_drive: number;
  park_outside: number;
  ota: number;
  title: string;
  idx_rank: number | null;
}

export interface CarPageRow { make_slug: string; model_slug: string; year: number; make: string; model: string; n: number; chars: number; latest: string; eligible: number; idx_rank: number | null }

const RECALL_COLS = 'r.campaign, r.date, r.manufacturer, r.component, r.summary, r.consequence, r.remedy, r.notes, r.units, r.do_not_drive, r.park_outside, r.ota, r.title, r.idx_rank';

/** Aggregates one vehicle page. The same expression is used by the backfill SQL and the daily sync. */
export const PAGE_ELIGIBLE_SQL = `CASE WHEN v.year >= ${FIRST_PAGE_MODEL_YEAR} AND (COUNT(*) >= 2 OR SUM(length(r.summary) + length(r.consequence) + length(r.remedy)) >= 700) THEN 1 ELSE 0 END`;

export function upsertCampaignStatements(db: D1Database, c: CarCampaign, isNew: boolean): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM car_vehicles WHERE campaign = ?').bind(c.campaign),
    db
      .prepare(
        `INSERT INTO car_recalls (campaign, date, manufacturer, component, summary, consequence, remedy, notes, units, do_not_drive, park_outside, ota, title, idx_rank)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(campaign) DO UPDATE SET date=excluded.date, manufacturer=excluded.manufacturer, component=excluded.component, summary=excluded.summary,
           consequence=excluded.consequence, remedy=excluded.remedy, notes=excluded.notes, units=excluded.units, do_not_drive=excluded.do_not_drive,
           park_outside=excluded.park_outside, ota=excluded.ota, title=excluded.title, idx_rank=COALESCE(car_recalls.idx_rank, excluded.idx_rank)`,
      )
      .bind(c.campaign, c.date, c.manufacturer, c.component, c.summary, c.consequence, c.remedy, c.notes, c.units, c.doNotDrive ? 1 : 0, c.parkOutside ? 1 : 0, c.ota ? 1 : 0, campaignTitle(c), isNew ? 0 : null),
  ];
  for (const v of c.vehicles) {
    stmts.push(db.prepare('INSERT OR IGNORE INTO car_vehicles (campaign, make_slug, model_slug, year, make, model) VALUES (?, ?, ?, ?, ?, ?)').bind(c.campaign, v.makeSlug, v.modelSlug, v.year, v.make, v.model));
  }
  const seen = new Set<string>();
  for (const v of c.vehicles) {
    const key = `${v.makeSlug}|${v.modelSlug}|${v.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stmts.push(
      db
        .prepare(
          `INSERT INTO car_pages (make_slug, model_slug, year, make, model, n, chars, latest, eligible, idx_rank)
           SELECT make_slug, model_slug, year, make, model, n, chars, latest, el, CASE WHEN el = 1 THEN 0 END FROM (
             SELECT v.make_slug, v.model_slug, v.year, MIN(v.make) AS make, MIN(v.model) AS model, COUNT(*) AS n,
                    SUM(length(r.summary) + length(r.consequence) + length(r.remedy)) AS chars, MAX(r.date) AS latest, ${PAGE_ELIGIBLE_SQL} AS el
             FROM car_vehicles v JOIN car_recalls r ON r.campaign = v.campaign
             WHERE v.make_slug = ?1 AND v.model_slug = ?2 AND v.year = ?3 GROUP BY v.make_slug, v.model_slug, v.year)
           WHERE true
           ON CONFLICT(make_slug, model_slug, year) DO UPDATE SET n=excluded.n, chars=excluded.chars, latest=excluded.latest, eligible=excluded.eligible,
             idx_rank=COALESCE(car_pages.idx_rank, CASE WHEN excluded.eligible = 1 THEN 0 END)`,
        )
        .bind(v.makeSlug, v.modelSlug, v.year),
    );
  }
  return stmts;
}

export async function knownCampaigns(db: D1Database, campaigns: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < campaigns.length; i += 80) {
    const chunk = campaigns.slice(i, i + 80);
    const { results } = await db.prepare(`SELECT campaign FROM car_recalls WHERE campaign IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all<{ campaign: string }>();
    for (const r of results) found.add(r.campaign);
  }
  return found;
}

export async function maxSequence(db: D1Database, yy: string): Promise<number> {
  const row = await db.prepare(`SELECT MAX(CAST(substr(campaign, 4, 3) AS INTEGER)) AS m FROM car_recalls WHERE campaign LIKE ?`).bind(`${yy}V%`).first<{ m: number | null }>();
  return row?.m ?? 0;
}

// ---------- reads ----------

export async function getCampaign(db: D1Database, campaign: string): Promise<{ recall: CarRecallRow; vehicles: { make: string; model: string; make_slug: string; model_slug: string; year: number }[] } | null> {
  const recall = await db.prepare(`SELECT ${RECALL_COLS.replace(/r\./g, '')} FROM car_recalls WHERE campaign = ?`).bind(campaign).first<CarRecallRow>();
  if (!recall) return null;
  const { results } = await db.prepare('SELECT make, model, make_slug, model_slug, year FROM car_vehicles WHERE campaign = ? ORDER BY make, model, year').bind(campaign).all<{ make: string; model: string; make_slug: string; model_slug: string; year: number }>();
  return { recall, vehicles: results };
}

export async function recallsForVehicle(db: D1Database, makeSlug: string, modelSlug: string, year: number): Promise<CarRecallRow[]> {
  const { results } = await db
    .prepare(`SELECT ${RECALL_COLS} FROM car_recalls r JOIN car_vehicles v ON v.campaign = r.campaign WHERE v.make_slug = ? AND v.model_slug = ? AND v.year = ? ORDER BY r.date DESC, r.campaign DESC`)
    .bind(makeSlug, modelSlug, year)
    .all<CarRecallRow>();
  return results;
}

export async function recallsForModel(db: D1Database, makeSlug: string, modelSlug: string, limit: number, offset: number): Promise<{ rows: CarRecallRow[]; total: number }> {
  const where = 'v.make_slug = ? AND v.model_slug = ?';
  const [{ results }, count] = await Promise.all([
    db.prepare(`SELECT ${RECALL_COLS} FROM car_recalls r WHERE r.campaign IN (SELECT v.campaign FROM car_vehicles v WHERE ${where}) ORDER BY r.date DESC, r.campaign DESC LIMIT ? OFFSET ?`).bind(makeSlug, modelSlug, limit, offset).all<CarRecallRow>(),
    db.prepare(`SELECT COUNT(DISTINCT v.campaign) AS n FROM car_vehicles v WHERE ${where}`).bind(makeSlug, modelSlug).first<{ n: number }>(),
  ]);
  return { rows: results, total: count?.n ?? 0 };
}

export async function recallsForMake(db: D1Database, makeSlug: string, limit: number, offset: number): Promise<{ rows: CarRecallRow[]; total: number }> {
  const [{ results }, count] = await Promise.all([
    db.prepare(`SELECT ${RECALL_COLS} FROM car_recalls r WHERE r.campaign IN (SELECT v.campaign FROM car_vehicles v WHERE v.make_slug = ?) ORDER BY r.date DESC, r.campaign DESC LIMIT ? OFFSET ?`).bind(makeSlug, limit, offset).all<CarRecallRow>(),
    db.prepare('SELECT COUNT(DISTINCT campaign) AS n FROM car_vehicles WHERE make_slug = ?').bind(makeSlug).first<{ n: number }>(),
  ]);
  return { rows: results, total: count?.n ?? 0 };
}

export async function latestCarRecalls(db: D1Database, limit: number, offset = 0): Promise<{ rows: CarRecallRow[]; total: number }> {
  const [{ results }, total] = await Promise.all([
    db.prepare(`SELECT ${RECALL_COLS} FROM car_recalls r ORDER BY r.date DESC, r.campaign DESC LIMIT ? OFFSET ?`).bind(limit, offset).all<CarRecallRow>(),
    memo(db, 'cars:total', 3 * HOURS, async () => (await db.prepare('SELECT COUNT(*) AS n FROM car_recalls').first<{ n: number }>())?.n ?? 0),
  ]);
  return { rows: results, total };
}

export interface MakeRow { make_slug: string; make: string; models: number; pages: number; recalls: number; latest: string }

export async function makesList(db: D1Database): Promise<MakeRow[]> {
  return memo(db, 'cars:makesList', 6 * HOURS, () => makesListQuery(db));
}

async function makesListQuery(db: D1Database): Promise<MakeRow[]> {
  const { results } = await db
    .prepare(`SELECT p.make_slug AS make_slug, MIN(p.make) AS make, COUNT(DISTINCT p.model_slug) AS models, COUNT(*) AS pages,
              (SELECT COUNT(DISTINCT campaign) FROM car_vehicles WHERE make_slug = p.make_slug) AS recalls, MAX(p.latest) AS latest
              FROM car_pages p GROUP BY p.make_slug ORDER BY recalls DESC`)
    .all<MakeRow>();
  return results;
}

export interface ModelRow { model_slug: string; model: string; years: number; recalls: number; latest: string; first_year: number; last_year: number }

export async function modelsForMake(db: D1Database, makeSlug: string): Promise<ModelRow[]> {
  return memo(db, `cars:models:${makeSlug}`, 6 * HOURS, () => modelsForMakeQuery(db, makeSlug));
}

async function modelsForMakeQuery(db: D1Database, makeSlug: string): Promise<ModelRow[]> {
  const { results } = await db
    .prepare(`SELECT p.model_slug AS model_slug, MIN(p.model) AS model, COUNT(*) AS years, MAX(p.latest) AS latest, MIN(p.year) AS first_year, MAX(p.year) AS last_year,
              (SELECT COUNT(DISTINCT campaign) FROM car_vehicles WHERE make_slug = p.make_slug AND model_slug = p.model_slug) AS recalls
              FROM car_pages p WHERE p.make_slug = ? GROUP BY p.model_slug ORDER BY recalls DESC`)
    .bind(makeSlug)
    .all<ModelRow>();
  return results;
}

export async function yearsForModel(db: D1Database, makeSlug: string, modelSlug: string): Promise<CarPageRow[]> {
  const { results } = await db.prepare('SELECT * FROM car_pages WHERE make_slug = ? AND model_slug = ? ORDER BY year DESC').bind(makeSlug, modelSlug).all<CarPageRow>();
  return results;
}

export async function getCarPage(db: D1Database, makeSlug: string, modelSlug: string, year: number): Promise<CarPageRow | null> {
  return db.prepare('SELECT * FROM car_pages WHERE make_slug = ? AND model_slug = ? AND year = ?').bind(makeSlug, modelSlug, year).first<CarPageRow>();
}

export async function searchCars(db: D1Database, q: string, limit = 40): Promise<CarPageRow[]> {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!terms.length) return [];
  const where = terms.map(() => `lower(make || ' ' || model || ' ' || year) LIKE ?`).join(' AND ');
  const { results } = await db.prepare(`SELECT * FROM car_pages WHERE ${where} ORDER BY n DESC, year DESC LIMIT ?`).bind(...terms.map((t) => `%${t.replace(/[%_]/g, '')}%`), limit).all<CarPageRow>();
  return results;
}

export async function carSitemapRows(db: D1Database, budget: number): Promise<{ pages: CarPageRow[]; campaigns: { campaign: string; date: string; component: string }[]; makes: { make_slug: string; latest: string; n: number }[]; models: { make_slug: string; model_slug: string; latest: string; years: number }[] }> {
  const [pages, campaigns, makes, models] = await Promise.all([
    db.prepare('SELECT * FROM car_pages WHERE eligible = 1 AND (idx_rank = 0 OR idx_rank <= ?) ORDER BY n DESC').bind(budget).all<CarPageRow>(),
    db.prepare('SELECT campaign, date, component FROM car_recalls WHERE idx_rank = 0 OR idx_rank <= ? ORDER BY date DESC').bind(budget).all<{ campaign: string; date: string; component: string }>(),
    db.prepare('SELECT make_slug, MAX(latest) AS latest, COUNT(DISTINCT model_slug) AS n FROM car_pages WHERE eligible = 1 GROUP BY make_slug HAVING COUNT(DISTINCT model_slug) >= 3').all<{ make_slug: string; latest: string; n: number }>(),
    db.prepare('SELECT make_slug, model_slug, MAX(latest) AS latest, COUNT(*) AS years FROM car_pages WHERE eligible = 1 GROUP BY make_slug, model_slug HAVING COUNT(*) >= 2').all<{ make_slug: string; model_slug: string; latest: string; years: number }>(),
  ]);
  return { pages: pages.results, campaigns: campaigns.results, makes: makes.results, models: models.results };
}
