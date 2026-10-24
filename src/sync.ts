import { existingIds, getMeta, setMetaStatement, upsertStatement } from './db.ts';
import { toRecall } from './derive.ts';
import type { CpscRecall, Env, Recall } from './types.ts';

export const CPSC_API = 'https://www.saferproducts.gov/RestWebServices/Recall';

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function fetchRecalls(query: Record<string, string>): Promise<CpscRecall[]> {
  const url = new URL(CPSC_API);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'RecallTracker/1.0 (daily incremental sync)' } });
  if (!res.ok) throw new Error(`CPSC API returned ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('CPSC API returned an unexpected payload');
  return data as CpscRecall[];
}

export interface SyncResult { fetched: number; added: Recall[]; changed: Recall[] }

/**
 * Pulls recalls published since the last successful run (minus a safety margin) and upserts them.
 * The watermark only moves forward when the whole run succeeds, so a failed run is retried
 * with the same window next time.
 */
export async function syncRecalls(env: Env, now = new Date()): Promise<SyncResult> {
  const last = await getMeta(env.DB, 'last_sync');
  const start = last ? new Date(new Date(`${last}T00:00:00Z`).getTime() - 4 * 86400000) : new Date(now.getTime() - 30 * 86400000);
  const raws = await fetchRecalls({ LastPublishDateStart: day(start) });
  const recalls = raws.filter((r) => r.RecallID && r.RecallNumber && r.Title && r.RecallDate).map(toRecall);

  const seen = await existingIds(env.DB, recalls.map((r) => r.id));
  const added = recalls.filter((r) => !seen.has(r.id));
  const changed = recalls.filter((r) => seen.has(r.id));

  const statements = recalls.map((r) => upsertStatement(env.DB, r, !seen.has(r.id)));
  for (let i = 0; i < statements.length; i += 40) await env.DB.batch(statements.slice(i, i + 40));
  await env.DB.batch([setMetaStatement(env.DB, 'last_sync', day(now)), setMetaStatement(env.DB, 'last_sync_at', now.toISOString()), setMetaStatement(env.DB, 'last_sync_count', String(recalls.length))]);
  return { fetched: recalls.length, added, changed };
}

/** Tell IndexNow-compatible engines (Bing, Yandex and others) about new or updated pages. */
export async function pingIndexNow(env: Env, urls: string[]): Promise<void> {
  if (!env.INDEXNOW_KEY || !urls.length) return;
  const host = new URL(env.SITE_URL).host;
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: env.INDEXNOW_KEY, keyLocation: `${env.SITE_URL}/${env.INDEXNOW_KEY}.txt`, urlList: urls.slice(0, 9000) }),
    });
  } catch {
    // Best effort: the sitemap remains the source of truth.
  }
}
