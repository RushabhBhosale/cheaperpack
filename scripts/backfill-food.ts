/**
 * One-time load of FDA food enforcement reports (2019 onward) into D1.
 *
 *   npm run backfill:food:local
 *   npm run backfill:food:remote   # run once, before going live
 *
 * Source: openFDA food enforcement endpoint (public domain, CC0). Set OPENFDA_KEY to use a free API key.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { foodSnippet } from '../src/food/db.ts';
import { FIRST_FOOD_YEAR, groupRows, type FdaRow } from '../src/food/derive.ts';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
const DB_NAME = 'recalls';
const key = process.env.OPENFDA_KEY ? `&api_key=${encodeURIComponent(process.env.OPENFDA_KEY)}` : '';

async function fetchPage(url: string): Promise<{ rows: FdaRow[]; total: number }> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'RecallTracker/1.0 (backfill)' } });
    if (res.status === 404) return { rows: [], total: 0 };
    if (res.ok) {
      const d = (await res.json()) as { results?: FdaRow[]; meta?: { results?: { total?: number } } };
      return { rows: d.results ?? [], total: d.meta?.results?.total ?? 0 };
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`openFDA request failed: ${url}`);
}

const rows: FdaRow[] = [];
for (let y = FIRST_FOOD_YEAR; y <= new Date().getUTCFullYear(); y++) {
  let skip = 0;
  for (;;) {
    const { rows: page, total } = await fetchPage(`https://api.fda.gov/food/enforcement.json?search=report_date:[${y}0101+TO+${y}1231]&limit=1000&skip=${skip}${key}`);
    rows.push(...page);
    skip += page.length;
    if (!page.length || skip >= total || skip >= 25000) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  process.stdout.write(`${y}:${skip} `);
}
const events = groupRows(rows).sort((a, b) => (a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : b.eventId.localeCompare(a.eventId)));
events.filter((e) => e.eligible).forEach((e, i) => (e.idxRank = i + 1));
console.log(`\n${rows.length} rows → ${events.length} events, ${events.filter((e) => e.eligible).length} eligible for indexing`);

const dir = join(tmpdir(), `food-backfill-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const q = (v: string | number | null) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
const wrangler = (file: string) => execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, target, '--yes', `--file=${file}`], { stdio: ['ignore', 'ignore', 'inherit'] });
const run = (name: string, sql: string) => { const f = join(dir, name); writeFileSync(f, sql); wrangler(f); };

run('clear.sql', 'DELETE FROM food_recalls;');
const CHUNK = 60;
for (let i = 0; i < events.length; i += CHUNK) {
  const sql = events.slice(i, i + CHUNK).map((e) => {
    const search = `${e.title} ${e.firm} ${e.products.map((p) => p.description).join(' ')}`.toLowerCase().slice(0, 4000);
    const cols = [e.eventId, e.slug, e.reportDate, e.firm, e.firmSlug, e.classification, e.status, e.title, foodSnippet(e), e.category, `|${e.hazards.join('|')}|`, e.chars, e.eligible ? 1 : 0, e.idxRank, search, JSON.stringify(e)];
    return `INSERT OR REPLACE INTO food_recalls (event_id, slug, report_date, firm, firm_slug, classification, status, title, snippet, category, hazards, chars, eligible, idx_rank, search_text, data) VALUES (${cols.map(q).join(', ')});`;
  }).join('\n');
  run(`food-${i}.sql`, sql);
  process.stdout.write(`.${Math.min(i + CHUNK, events.length)} `);
}
run('meta.sql', `INSERT OR REPLACE INTO meta (key, value) VALUES ('food_last_sync', '${new Date().toISOString().slice(0, 10)}');`);
rmSync(dir, { recursive: true, force: true });
console.log(`\nDone. Loaded ${events.length} food recall events into ${target.slice(2)} D1.`);
