import { slugify } from '../derive.ts';

/** Passenger-vehicle makes covered by the /cars/ section (trucks, buses and motorcycles are left out). */
export const CONSUMER_MAKES: Record<string, string> = {
  'ACURA': 'Acura', 'ALFA ROMEO': 'Alfa Romeo', 'ASTON MARTIN': 'Aston Martin', 'AUDI': 'Audi', 'BENTLEY': 'Bentley', 'BMW': 'BMW', 'BUICK': 'Buick',
  'CADILLAC': 'Cadillac', 'CHEVROLET': 'Chevrolet', 'CHRYSLER': 'Chrysler', 'DODGE': 'Dodge', 'FERRARI': 'Ferrari', 'FIAT': 'Fiat', 'FISKER': 'Fisker', 'FORD': 'Ford',
  'GENESIS': 'Genesis', 'GMC': 'GMC', 'HONDA': 'Honda', 'HYUNDAI': 'Hyundai', 'INFINITI': 'Infiniti', 'JAGUAR': 'Jaguar', 'JEEP': 'Jeep', 'KIA': 'Kia',
  'LAMBORGHINI': 'Lamborghini', 'LAND ROVER': 'Land Rover', 'LEXUS': 'Lexus', 'LINCOLN': 'Lincoln', 'LOTUS': 'Lotus', 'LUCID': 'Lucid', 'MASERATI': 'Maserati',
  'MAZDA': 'Mazda', 'MCLAREN': 'McLaren', 'MERCEDES-BENZ': 'Mercedes-Benz', 'MERCURY': 'Mercury', 'MINI': 'MINI', 'MITSUBISHI': 'Mitsubishi', 'NISSAN': 'Nissan',
  'POLESTAR': 'Polestar', 'PONTIAC': 'Pontiac', 'PORSCHE': 'Porsche', 'RAM': 'RAM', 'RIVIAN': 'Rivian', 'ROLLS-ROYCE': 'Rolls-Royce', 'SATURN': 'Saturn', 'SCION': 'Scion',
  'SMART': 'smart', 'SUBARU': 'Subaru', 'SUZUKI': 'Suzuki', 'TESLA': 'Tesla', 'TOYOTA': 'Toyota', 'VOLKSWAGEN': 'Volkswagen', 'VOLVO': 'Volvo',
};

export const FIRST_CAMPAIGN_YEAR = 2013;
export const FIRST_PAGE_MODEL_YEAR = 2008;

export interface CarVehicle { make: string; model: string; year: number; makeSlug: string; modelSlug: string }

export interface CarCampaign {
  campaign: string;
  date: string;
  manufacturer: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  notes: string;
  units: number | null;
  doNotDrive: boolean;
  parkOutside: boolean;
  ota: boolean;
  vehicles: CarVehicle[];
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').replace(/<\/?[^>]+>/g, '').trim();

/** `ACCORD HYBRID` → `Accord Hybrid`, `F-150` and `CR-V` stay upper case. */
export function prettyModel(raw: string): string {
  return clean(raw)
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => (/\d/.test(part) || part.length <= 2 || /^(?:GT|GTI|SUV|EV|XL|LX|SE|SL|SLK|CLK|ML|GL|WRX|STI|TRD|ATS|CTS|XTS|CT6|MKZ|MKX|MKC|NX|RX|GX|LX|UX|ES|IS|GS|LS|RC|LC|CX|MX)$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
        .join('-'),
    )
    .join(' ');
}

export const prettyMake = (raw: string): string => CONSUMER_MAKES[clean(raw).toUpperCase()] ?? clean(raw);

/** `ELECTRICAL SYSTEM:BODY CONTROL MODULE:SOFTWARE` → `Electrical system: body control module, software`. */
export function prettyComponent(raw: string): string {
  const parts = clean(raw).split(':').map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return 'Safety defect';
  const [head = '', ...rest] = parts;
  const text = rest.length ? `${head}: ${rest.join(', ')}` : head;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `Honda (American Honda Motor Co.)` → `Honda`. */
export const prettyManufacturer = (raw: string): string => clean(raw).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || clean(raw);

/** NHTSA uses DD/MM/YYYY in the API and YYYYMMDD in the flat file. */
export function isoDate(raw: string): string {
  const s = clean(raw);
  const a = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (a) return `${a[3]}-${a[2]}-${a[1]}`;
  const b = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (b) return `${b[1]}-${b[2]}-${b[3]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

export function toVehicle(make: string, model: string, year: string | number): CarVehicle | null {
  const y = Number(year);
  const m = clean(make).toUpperCase();
  if (!CONSUMER_MAKES[m] || !Number.isInteger(y) || y < 1990 || y > new Date().getUTCFullYear() + 2) return null;
  const modelName = prettyModel(model);
  if (!modelName || /^(?:unknown|n\/?a|various)$/i.test(modelName)) return null;
  return { make: CONSUMER_MAKES[m]!, model: modelName, year: y, makeSlug: slugify(CONSUMER_MAKES[m]!), modelSlug: slugify(modelName) };
}

export const campaignYear = (campaign: string): number => 2000 + Number(campaign.slice(0, 2));

/** A campaign is worth a page only if NHTSA gave us real text to show. */
export const isUsable = (c: CarCampaign): boolean => c.vehicles.length > 0 && c.summary.length >= 80 && c.remedy.length >= 20 && Boolean(c.date) && campaignYear(c.campaign) >= FIRST_CAMPAIGN_YEAR;

export function campaignTitle(c: CarCampaign): string {
  const byMake = new Map<string, { models: Set<string>; min: number; max: number }>();
  for (const v of c.vehicles) {
    const e = byMake.get(v.make) ?? { models: new Set<string>(), min: v.year, max: v.year };
    e.models.add(v.model);
    e.min = Math.min(e.min, v.year);
    e.max = Math.max(e.max, v.year);
    byMake.set(v.make, e);
  }
  const parts = [...byMake.entries()].slice(0, 2).map(([make, e]) => {
    const models = [...e.models];
    const shown = models.slice(0, 3).join(', ') + (models.length > 3 ? ' and more' : '');
    return `${e.min === e.max ? e.min : `${e.min}–${e.max}`} ${make} ${shown}`;
  });
  const extra = byMake.size > 2 ? ' and more' : '';
  return `${parts.join(' and ')}${extra} recall: ${prettyComponent(c.component)}`;
}

/** Normalise one `recallsByVehicle` / `campaignNumber` API payload (rows of one campaign). */
export function fromApiRows(rows: Record<string, unknown>[]): CarCampaign | null {
  const first = rows[0];
  if (!first) return null;
  const campaign = clean(String(first.NHTSACampaignNumber ?? '')).toUpperCase();
  if (!/^\d{2}V\d{6}$/.test(campaign)) return null;
  const vehicles: CarVehicle[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const v = toVehicle(String(r.Make ?? ''), String(r.Model ?? ''), String(r.ModelYear ?? ''));
    const key = v ? `${v.makeSlug}|${v.modelSlug}|${v.year}` : '';
    if (v && !seen.has(key)) { seen.add(key); vehicles.push(v); }
  }
  const units = Number(first.PotentialNumberofUnitsAffected);
  return {
    campaign,
    date: isoDate(String(first.ReportReceivedDate ?? '')),
    manufacturer: prettyManufacturer(String(first.Manufacturer ?? '')),
    component: clean(String(first.Component ?? '')),
    summary: clean(String(first.Summary ?? '')),
    consequence: clean(String(first.Consequence ?? '')),
    remedy: clean(String(first.Remedy ?? '')),
    notes: clean(String(first.Notes ?? '')),
    units: Number.isFinite(units) && units > 0 ? units : null,
    doNotDrive: first.parkIt === true,
    parkOutside: first.parkOutSide === true,
    ota: first.overTheAirUpdate === true,
    vehicles,
  };
}
