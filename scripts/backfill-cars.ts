/**
 * One-time load of NHTSA vehicle recalls (campaigns from 2013 onward, passenger-vehicle makes) into D1.
 *
 *   npm run backfill:cars:local
 *   npm run backfill:cars:remote   # run once, before going live
 *
 * Source: NHTSA's public flat file (FLAT_RCL_POST_2010.zip). The daily sync then keeps it current
 * through the NHTSA API (see src/cars/sync.ts).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { campaignTitle, campaignYear, isUsable, isoDate, pageEligible, prettyManufacturer, toVehicle, type CarCampaign } from '../src/cars/derive.ts';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
// Re-run only the page aggregation (used to resume after an interrupted import).
const pagesOnly = process.argv.includes('--pages-only');
const DB_NAME = 'recalls';
const URL_ZIP = 'https://static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL_POST_2010.zip';

const dir = join(tmpdir(), `car-backfill-${Date.now()}`);
mkdirSync(dir, { recursive: true });

console.log('Downloading NHTSA flat file…');
const res = await fetch(URL_ZIP, { headers: { 'User-Agent': 'RecallTracker/1.0 (backfill)' } });
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const zipPath = join(dir, 'rcl.zip');
writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
const text = execFileSync('unzip', ['-p', zipPath], { maxBuffer: 1024 * 1024 * 1024 }).toString('latin1');

const clean = (s: string | undefined) => (s ?? '').replace(/<\/?[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const campaigns = new Map<string, CarCampaign>();
for (const line of text.split(/\r?\n/)) {
  if (!line) continue;
  const f = line.split('\t');
  if (f.length < 29 || f[10] !== 'V') continue;
  const campaign = (f[1] ?? '').trim().toUpperCase();
  if (!/^\d{2}V\d{6}$/.test(campaign) || campaignYear(campaign) < 2013) continue;
  const vehicle = toVehicle(f[2] ?? '', f[3] ?? '', f[4] ?? '');
  if (!vehicle) continue;
  let c = campaigns.get(campaign);
  if (!c) {
    const units = Number(f[11]);
    c = {
      campaign, date: isoDate(f[15] ?? ''), manufacturer: prettyManufacturer(f[14] ?? ''), component: clean(f[6]), summary: clean(f[19]), consequence: clean(f[20]),
      remedy: clean(f[21]), notes: clean(f[22]), units: Number.isFinite(units) && units > 0 ? units : null,
      doNotDrive: (f[27] ?? '').trim().toLowerCase() === 'yes', parkOutside: (f[28] ?? '').trim().toLowerCase() === 'yes', ota: false, vehicles: [],
    };
    campaigns.set(campaign, c);
  }
  if (!c.vehicles.some((v) => v.makeSlug === vehicle.makeSlug && v.modelSlug === vehicle.modelSlug && v.year === vehicle.year)) c.vehicles.push(vehicle);
}
const usable = [...campaigns.values()].filter(isUsable).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.campaign.localeCompare(a.campaign)));
console.log(`${campaigns.size} campaigns parsed, ${usable.length} usable, ${usable.reduce((n, c) => n + c.vehicles.length, 0)} vehicle rows`);

const q = (v: string | number | null) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
const wrangler = (args: string[]) => execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, target, '--yes', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
const runSql = (name: string, sql: string) => {
  const file = join(dir, name);
  writeFileSync(file, sql);
  wrangler([`--file=${file}`]);
};

if (!pagesOnly) runSql('clear.sql', 'DELETE FROM car_vehicles; DELETE FROM car_recalls; DELETE FROM car_pages;');

const CHUNK = 250;
for (let i = 0; !pagesOnly && i < usable.length; i += CHUNK) {
  const slice = usable.slice(i, i + CHUNK);
  const sql: string[] = [];
  slice.forEach((c, j) => {
    const rank = i + j + 1;
    sql.push(`INSERT OR REPLACE INTO car_recalls (campaign, date, manufacturer, component, summary, consequence, remedy, notes, units, do_not_drive, park_outside, ota, title, idx_rank) VALUES (${[c.campaign, c.date, c.manufacturer, c.component, c.summary, c.consequence, c.remedy, c.notes, c.units, c.doNotDrive ? 1 : 0, c.parkOutside ? 1 : 0, 0, campaignTitle(c), rank].map(q).join(', ')});`);
    for (let k = 0; k < c.vehicles.length; k += 80) {
      const rows = c.vehicles.slice(k, k + 80).map((v) => `(${[c.campaign, v.makeSlug, v.modelSlug, v.year, v.make, v.model].map(q).join(', ')})`);
      sql.push(`INSERT OR IGNORE INTO car_vehicles (campaign, make_slug, model_slug, year, make, model) VALUES ${rows.join(', ')};`);
    }
  });
  runSql(`camp-${i}.sql`, sql.join('\n'));
  process.stdout.write(`.${Math.min(i + CHUNK, usable.length)} `);
}

// Page aggregates are computed here, not in SQL: the same query exceeds D1's CPU limit on 30,000 rows.
interface PageAgg { makeSlug: string; modelSlug: string; year: number; make: string; model: string; n: number; chars: number; latest: string }
const pages = new Map<string, PageAgg>();
for (const c of usable) {
  const chars = c.summary.length + c.consequence.length + c.remedy.length;
  for (const v of c.vehicles) {
    const key = `${v.makeSlug}|${v.modelSlug}|${v.year}`;
    const p = pages.get(key) ?? { makeSlug: v.makeSlug, modelSlug: v.modelSlug, year: v.year, make: v.make, model: v.model, n: 0, chars: 0, latest: '' };
    p.n += 1;
    p.chars += chars;
    if (c.date > p.latest) p.latest = c.date;
    pages.set(key, p);
  }
}
const pageList = [...pages.values()];
const eligible = pageList.filter((p) => pageEligible(p.year, p.n, p.chars)).sort((a, b) => b.n - a.n || b.year - a.year || a.makeSlug.localeCompare(b.makeSlug) || a.modelSlug.localeCompare(b.modelSlug));
const rank = new Map(eligible.map((p, i) => [`${p.makeSlug}|${p.modelSlug}|${p.year}`, i + 1]));
runSql('pages-clear.sql', 'DELETE FROM car_pages;');
for (let i = 0; i < pageList.length; i += 400) {
  const rows = pageList.slice(i, i + 400).map((p) => {
    const ok = pageEligible(p.year, p.n, p.chars);
    return `(${[p.makeSlug, p.modelSlug, p.year, p.make, p.model, p.n, p.chars, p.latest, ok ? 1 : 0, ok ? (rank.get(`${p.makeSlug}|${p.modelSlug}|${p.year}`) ?? null) : null].map(q).join(', ')})`;
  });
  runSql(`pages-${i}.sql`, `INSERT INTO car_pages (make_slug, model_slug, year, make, model, n, chars, latest, eligible, idx_rank) VALUES ${rows.join(', ')};`);
  process.stdout.write(`p${Math.min(i + 400, pageList.length)} `);
}
rmSync(dir, { recursive: true, force: true });
console.log(`\nDone. Loaded ${usable.length} vehicle recall campaigns and ${pageList.length} vehicle pages (${eligible.length} indexable) into ${target.slice(2)} D1.`);
