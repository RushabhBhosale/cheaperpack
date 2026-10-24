/**
 * One-time load of the full CPSC recall history into D1.
 *
 *   npm run backfill:local     # local D1 used by `wrangler dev`
 *   npm run backfill:remote    # production D1 (run once, before going live)
 *
 * Recalls from 2019 onward that pass the quality gate get a stable "drip rank" (newest first).
 * The site only lets that many recalls into the index, growing a little each day, so Google sees
 * the site grow steadily instead of ten thousand brand-new URLs at once.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snippetOf } from '../src/db.ts';
import { toRecall } from '../src/derive.ts';
import type { CpscRecall, Recall } from '../src/types.ts';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
const DB_NAME = 'recalls';
const API = 'https://www.saferproducts.gov/RestWebServices/Recall';

async function fetchYear(year: number): Promise<CpscRecall[]> {
  const url = `${API}?format=json&RecallDateStart=${year}-01-01&RecallDateEnd=${year}-12-31`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'RecallTracker/1.0 (backfill)' } });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as CpscRecall[];
    } catch (e) {
      if (attempt === 3) throw new Error(`Year ${year} failed: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return [];
}

const q = (v: string | number | null) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

function insertSql(r: Recall): string {
  const search = `${r.short_title} ${r.brand} ${r.products.map((p) => `${p.name} ${p.model}`).join(' ')}`.toLowerCase();
  const cols = [r.id, r.number, r.slug, r.date, r.last_publish, r.short_title, snippetOf(r.description), r.brand, r.brand_slug, r.category, `|${r.hazards.join('|')}|`, r.quality, r.eligible ? 1 : 0, r.idx_rank, search, JSON.stringify(r)];
  return `INSERT OR REPLACE INTO recalls (id, number, slug, date, last_publish, short_title, snippet, brand, brand_slug, category, hazards, quality, eligible, idx_rank, search_text, data) VALUES (${cols.map(q).join(', ')});`;
}

const thisYear = new Date().getFullYear();
const raws: CpscRecall[] = [];
for (let y = 1973; y <= thisYear; y++) {
  const rows = await fetchYear(y);
  raws.push(...rows);
  process.stdout.write(`${y}:${rows.length} `);
  await new Promise((r) => setTimeout(r, 250));
}
console.log(`\nFetched ${raws.length} recalls`);

const byNumber = new Map<string, Recall>();
for (const raw of raws) {
  if (!raw.RecallID || !raw.RecallNumber || !raw.Title || !raw.RecallDate) continue;
  const r = toRecall(raw);
  byNumber.set(r.number, r);
}
const recalls = [...byNumber.values()];

recalls
  .filter((r) => r.eligible)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
  .forEach((r, i) => (r.idx_rank = i + 1));
console.log(`${recalls.length} unique recalls, ${recalls.filter((r) => r.eligible).length} eligible for indexing`);

const dir = join(tmpdir(), `recall-backfill-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const CHUNK = 350;
const wrangler = (file: string) => execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, target, `--file=${file}`, '--yes'], { stdio: ['ignore', 'ignore', 'inherit'] });
for (let i = 0; i < recalls.length; i += CHUNK) {
  const file = join(dir, `chunk-${String(i / CHUNK).padStart(3, '0')}.sql`);
  writeFileSync(file, recalls.slice(i, i + CHUNK).map(insertSql).join('\n'));
  wrangler(file);
  process.stdout.write(`.${Math.min(i + CHUNK, recalls.length)} `);
}
const meta = join(dir, 'meta.sql');
const today = new Date().toISOString().slice(0, 10);
writeFileSync(meta, `INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', '${today}'), ('backfilled_at', '${new Date().toISOString()}');`);
wrangler(meta);
rmSync(dir, { recursive: true, force: true });
console.log(`\nDone. Backfilled ${recalls.length} recalls into ${target.slice(2)} D1.`);
