import { getMeta, setMetaStatement } from '../db.ts';
import type { Env } from '../types.ts';
import { knownCampaigns, maxSequence, upsertCampaignStatements } from './db.ts';
import { fromApiRows, isUsable, type CarCampaign } from './derive.ts';

const API = 'https://api.nhtsa.gov/recalls/campaignNumber';
const MAX_PROBES = 36; // stays well inside the 50-subrequest limit of the free plan
const MAX_MISSES = 8; // NHTSA numbers have small gaps; eight misses in a row means we are at the end

async function fetchCampaign(campaign: string): Promise<{ exists: boolean; parsed: CarCampaign | null }> {
  const res = await fetch(`${API}?campaignNumber=${campaign}`, { headers: { Accept: 'application/json', 'User-Agent': 'RecallTracker/1.0 (daily sync)' } });
  if (!res.ok) throw new Error(`NHTSA API returned ${res.status} for ${campaign}`);
  const data = (await res.json()) as { Count?: number; results?: Record<string, unknown>[] };
  const rows = data.results ?? [];
  return { exists: rows.length > 0, parsed: rows.length ? fromApiRows(rows) : null };
}

export interface CarSyncResult { probed: number; added: CarCampaign[] }

/**
 * NHTSA's API has no "published since" filter, but campaign numbers are sequential
 * (26V681000, 26V682000, …). Each run continues from the highest number seen and stops
 * after a run of empty numbers.
 */
export async function syncCars(env: Env, now = new Date()): Promise<CarSyncResult> {
  const yearNow = now.getUTCFullYear();
  const years = [yearNow, ...(now.getUTCMonth() < 2 ? [yearNow - 1] : [])].map((y) => String(y).slice(2));
  const found: CarCampaign[] = [];
  const metaWrites: D1PreparedStatement[] = [];
  let probes = 0;

  for (const yy of years) {
    const metaKey = `car_seq_${yy}`;
    let seq = Math.max(Number(await getMeta(env.DB, metaKey)) || 0, await maxSequence(env.DB, yy));
    let misses = 0;
    let n = seq;
    while (misses < MAX_MISSES && probes < MAX_PROBES) {
      n += 1;
      probes += 1;
      const { exists, parsed } = await fetchCampaign(`${yy}V${String(n).padStart(3, '0')}000`);
      if (!exists) { misses += 1; continue; }
      misses = 0;
      seq = n;
      if (parsed && isUsable(parsed)) found.push(parsed);
    }
    metaWrites.push(setMetaStatement(env.DB, metaKey, String(seq)));
  }

  const known = await knownCampaigns(env.DB, found.map((c) => c.campaign));
  const stmts = found.flatMap((c) => upsertCampaignStatements(env.DB, c, !known.has(c.campaign)));
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  await env.DB.batch([...metaWrites, setMetaStatement(env.DB, 'car_last_sync_at', now.toISOString()), setMetaStatement(env.DB, 'car_last_sync_count', String(found.length))]);
  return { probed: probes, added: found.filter((c) => !known.has(c.campaign)) };
}
