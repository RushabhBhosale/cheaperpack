/**
 * Caches expensive aggregate query results (category counts, brand lists and so on) inside D1 itself,
 * so one request every few hours does the work for the whole world instead of every uncached page view.
 * This keeps rows-read low, which matters on D1's free plan (5 million rows read per day).
 */
interface Stored<T> { t: number; v: T }

export async function memo<T>(db: D1Database, key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const metaKey = `memo:${key}`;
  let stale: Stored<T> | null = null;
  try {
    const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind(metaKey).first<{ value: string }>();
    if (row) {
      stale = JSON.parse(row.value) as Stored<T>;
      if (Date.now() - stale.t < ttlSeconds * 1000) return stale.v;
    }
  } catch {
    stale = null;
  }
  try {
    const v = await compute();
    await db.prepare('INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(metaKey, JSON.stringify({ t: Date.now(), v } satisfies Stored<T>)).run();
    return v;
  } catch (err) {
    if (stale) return stale.v; // serve the old numbers rather than fail the page
    throw err;
  }
}

export const HOURS = 3600;
