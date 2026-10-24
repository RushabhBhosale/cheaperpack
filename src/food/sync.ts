import type { Env } from '../types.ts';
import { getMeta, knownFoodEvents, setMetaStatement, upsertFoodStatement } from './db.ts';
import { groupRows, type FdaRow, type FoodEvent } from './derive.ts';

const API = 'https://api.fda.gov/food/enforcement.json';
const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export async function fetchFdaRows(env: Env, start: string, end: string, skip = 0): Promise<{ rows: FdaRow[]; total: number }> {
  const url = `${API}?search=report_date:[${start}+TO+${end}]&limit=1000&skip=${skip}${env.OPENFDA_KEY ? `&api_key=${encodeURIComponent(env.OPENFDA_KEY)}` : ''}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'RecallTracker/1.0 (daily sync)' } });
  if (res.status === 404) return { rows: [], total: 0 }; // openFDA answers 404 when a search matches nothing
  if (!res.ok) throw new Error(`openFDA returned ${res.status}`);
  const data = (await res.json()) as { results?: FdaRow[]; meta?: { results?: { total?: number } } };
  return { rows: data.results ?? [], total: data.meta?.results?.total ?? 0 };
}

export interface FoodSyncResult { rows: number; added: FoodEvent[] }

/**
 * FDA publishes enforcement reports weekly. Each run re-reads the last three weeks, which also
 * picks up recalls that were classified late. The watermark only advances on success.
 */
export async function syncFood(env: Env, now = new Date()): Promise<FoodSyncResult> {
  const last = await getMeta(env.DB, 'food_last_sync');
  const start = last ? new Date(new Date(`${last}T00:00:00Z`).getTime() - 21 * 86400000) : new Date(now.getTime() - 45 * 86400000);
  let { rows, total } = await fetchFdaRows(env, day(start), day(now));
  if (total > rows.length && rows.length === 1000) rows = [...rows, ...(await fetchFdaRows(env, day(start), day(now), 1000)).rows];
  const events = groupRows(rows);
  const known = await knownFoodEvents(env.DB, events.map((e) => e.eventId));
  const stmts = events.map((e) => upsertFoodStatement(env.DB, e, !known.has(e.eventId)));
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  await env.DB.batch([setMetaStatement(env.DB, 'food_last_sync', now.toISOString().slice(0, 10)), setMetaStatement(env.DB, 'food_last_sync_at', now.toISOString()), setMetaStatement(env.DB, 'food_last_sync_count', String(events.length))]);
  return { rows: rows.length, added: events.filter((e) => !known.has(e.eventId)) };
}
