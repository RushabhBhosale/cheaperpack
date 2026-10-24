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
import { campaignTitle, campaignYear, isUsable, isoDate, prettyManufacturer, toVehicle, type CarCampaign } from '../src/cars/derive.ts';
import { PAGE_ELIGIBLE_SQL } from '../src/cars/db.ts';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
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

runSql('clear.sql', 'DELETE FROM car_vehicles; DELETE FROM car_recalls; DELETE FROM car_pages;');

const CHUNK = 250;
for (let i = 0; i < usable.length; i += CHUNK) {
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

runSql(
  'pages.sql',
  `INSERT INTO car_pages (make_slug, model_slug, year, make, model, n, chars, latest, eligible, idx_rank)
   SELECT v.make_slug, v.model_slug, v.year, MIN(v.make), MIN(v.model), COUNT(*), SUM(length(r.summary) + length(r.consequence) + length(r.remedy)), MAX(r.date), ${PAGE_ELIGIBLE_SQL}, NULL
   FROM car_vehicles v JOIN car_recalls r ON r.campaign = v.campaign GROUP BY v.make_slug, v.model_slug, v.year;
   WITH ranked AS (SELECT make_slug, model_slug, year, ROW_NUMBER() OVER (ORDER BY n DESC, year DESC, make_slug, model_slug) AS rn FROM car_pages WHERE eligible = 1)
   UPDATE car_pages SET idx_rank = (SELECT rn FROM ranked WHERE ranked.make_slug = car_pages.make_slug AND ranked.model_slug = car_pages.model_slug AND ranked.year = car_pages.year) WHERE eligible = 1;`,
);
rmSync(dir, { recursive: true, force: true });
console.log(`\nDone. Loaded ${usable.length} vehicle recall campaigns into ${target.slice(2)} D1.`);
