import type { CpscRecall, ImageInfo, ProductInfo, Recall } from './types.ts';

export const FIRST_INDEXABLE_YEAR = 2019;
export const MIN_QUALITY = 70;

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** CPSC shows 5-digit numbers as 27-042. */
export function displayNumber(n: string): string {
  return /^\d{5}$/.test(n) ? `${n.slice(0, 2)}-${n.slice(2)}` : n;
}

// ---------- brand ----------

const SUFFIX = /[,\s]+(?:industries|holdings|group|international|enterprises|brands|inc\.?|incorporated|llc|l\.l\.c\.?|ltd\.?|limited|co\.?|corp\.?|corporation|company|gmbh|s\.a\.|plc|usa|u\.s\.a\.|america|north america)\.?$/i;

/** `Anker Innovations Limited, of China` → `Anker Innovations`. */
export function normalizeBrand(raw: string): string {
  let b = clean(raw)
    .replace(/\s*,?\s*(?:doing business as|dba|d\/b\/a)\b.*$/i, '')
    .replace(/,?\s+of\s+[A-Z][\w .,'-]*$/, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
  for (let i = 0; i < 3; i++) b = b.replace(SUFFIX, '').trim();
  b = b.replace(/[,.;:]+$/, '').trim();
  return b;
}

export function extractBrand(title: string, manufacturers: string[]): string {
  const by = title.match(/\bRecalled by\s+(.+?)(?=\s+(?:Due to|Because)\b|\s*[;:]|$)/i);
  if (by?.[1]) return normalizeBrand(by[1]);
  const m = title.match(/^(.+?)\s+(?:Recalls?|Recalling|Recalled|Issues? Recall|Announces? Recall|Voluntarily Recalls?)\b/i);
  let candidate = m?.[1] ? clean(m[1]) : '';
  // "A and B Recall X", "A, B Recall X": keep the first firm.
  candidate = candidate.split(/\s*,\s*|\s+and\s+|\s+&\s+|\s+Joint\b/i)[0] ?? candidate;
  if (!candidate || candidate.length > 60 || /^(?:cpsc|consumer product safety commission)$/i.test(candidate)) {
    candidate = manufacturers[0] ?? '';
  }
  return normalizeBrand(candidate);
}

// ---------- hazards ----------

export const HAZARDS: { slug: string; label: string; name: string; plural: string; test: RegExp; blurb: string }[] = [
  { slug: 'fire-burn', label: 'Fire risk', name: 'Fire and burn', plural: 'fire and burn hazards', test: /\bfire|burn|overheat|ignit|flam|thermal runaway|combust|smoke|melt/i, blurb: 'Products that can overheat, ignite or burn people.' },
  { slug: 'electric-shock', label: 'Shock risk', name: 'Electric shock', plural: 'electric shock hazards', test: /shock|electrocut/i, blurb: 'Products that can give an electric shock or electrocution.' },
  { slug: 'choking-ingestion', label: 'Choking risk', name: 'Choking and ingestion', plural: 'choking and ingestion hazards', test: /chok|aspirat|swallow|ingest|small parts?/i, blurb: 'Small parts, button batteries and magnets that can be swallowed.' },
  { slug: 'laceration', label: 'Cut risk', name: 'Laceration and cuts', plural: 'laceration hazards', test: /lacerat|\bcuts?\b|sharp|amputat|blade/i, blurb: 'Products that can cut or injure through sharp edges and parts.' },
  { slug: 'falls-tip-overs', label: 'Fall risk', name: 'Falls and tip-overs', plural: 'fall and tip-over hazards', test: /\bfalls?\b|falling|tip[- ]?overs?|tipping|collaps|instab/i, blurb: 'Products that can fall, tip over or collapse.' },
  { slug: 'poisoning-toxic', label: 'Poisoning risk', name: 'Poisoning and toxic substances', plural: 'poisoning hazards', test: /poison|\blead\b|chemical|toxic|carbon monoxide|mercury|cadmium|chemical burn/i, blurb: 'Lead, chemicals and other toxic substances.' },
  { slug: 'suffocation-strangulation', label: 'Suffocation risk', name: 'Suffocation and strangulation', plural: 'suffocation and strangulation hazards', test: /strangul|suffocat|asphyx|entrap|drown|entangle/i, blurb: 'Products linked to suffocation, strangulation, entrapment or drowning.' },
  { slug: 'crash-injury', label: 'Crash risk', name: 'Crashes and loss of control', plural: 'crash and loss-of-control hazards', test: /crash|collision|loss of control|brake|steering|rollover|vehicle/i, blurb: 'Vehicles and ride-on products that can crash or lose control.' },
];

export function classifyHazards(hazardNames: string[], clause: string): string[] {
  const text = `${hazardNames.join(' ')} ${clause}`;
  return HAZARDS.filter((h) => h.test.test(text)).map((h) => h.slug);
}

/** `Acme Recalls X Due to Fire Hazard` → `Fire Hazard`. */
export function hazardClause(title: string): string {
  const m = title.match(/\b(?:due to|because of|because)\b\s+(.+)$/i);
  return clean(m?.[1] ?? '');
}

// ---------- categories ----------

export const CATEGORIES: { slug: string; name: string; plural: string; test: RegExp; blurb: string; tech?: boolean }[] = [
  { slug: 'baby-products', name: 'Baby and nursery', plural: 'baby and nursery products', blurb: 'Cribs, strollers, high chairs, car seats and other products for babies and toddlers.', test: /\b(?:cribs?|bassinets?|strollers?|high ?chairs?|infants?|babies|baby|toddlers?|nurser(?:y|ies)|pacifiers?|bouncers?|rockers?|car seats?|booster seats?|play ?yards?|playpens?|diaper|teethers?|sleepers?|changing tables?|bath ?seats?|baby gates?|walkers?|carriers?|slings?|bibs?|bottle warmers?|co-?sleepers?|swaddles?)\b/i },
  { slug: 'toys', name: 'Toys and games', plural: 'toys and games', blurb: 'Toys, games, play sets and kids’ ride-ons.', test: /\b(?:toys?|dolls?|plush|stuffed|puzzles?|play ?sets?|slime|figures?|building (?:blocks?|sets?)|magnet (?:balls?|sets?)|squish\w*|fidget|games?|ride-?ons?|rattles?|finger lights?|water beads?|bubble|kits? for kids)\b/i },
  { slug: 'e-bikes-scooters', name: 'E-bikes, e-scooters and hoverboards', plural: 'e-bikes, e-scooters and hoverboards', tech: true, blurb: 'Electric bikes, scooters, hoverboards and their lithium-ion batteries.', test: /\b(?:e-?bikes?|electric bi(?:ke|cycle)s?|e-?scooters?|electric scooters?|hoverboards?|self-balancing|electric unicycles?|electric skateboards?|micromobility|e-?motorcycles?|electric (?:dirt|trail) bikes?)\b/i },
  { slug: 'home-safety', name: 'Smoke alarms and home safety', plural: 'smoke alarms and home safety devices', blurb: 'Smoke and carbon monoxide alarms, fire extinguishers and similar devices.', test: /\b(?:smoke (?:alarms?|detectors?)|carbon monoxide (?:alarms?|detectors?)|co alarms?|fire extinguishers?|detectors?|alarms?|gas (?:leak|shut-?off)|safety gates?)\b/i },
  { slug: 'power-banks-chargers', name: 'Power banks, chargers and batteries', plural: 'power banks, chargers and batteries', tech: true, blurb: 'Portable chargers, power banks, adapters and lithium-ion battery packs.', test: /\b(?:power ?banks?|portable (?:power )?(?:chargers?|stations?)|battery packs?|chargers?|adapters?|adaptors?|power supplies|power supply|power stations?|batter(?:y|ies)|charging (?:cables?|cords?|docks?|cases?)|usb (?:cables?|chargers?|adapters?))\b/i },
  { slug: 'phones-computers-electronics', name: 'Phones, computers and electronics', plural: 'phones, computers and consumer electronics', tech: true, blurb: 'Phones, laptops, tablets, headphones, speakers, TVs and other consumer electronics.', test: /\b(?:phones?|smartphones?|laptops?|notebooks?|computers?|tablets?|headphones?|earbuds?|earphones?|speakers?|soundbars?|monitors?|televisions?|tvs?|routers?|cameras?|smart ?watch(?:es)?|fitness trackers?|vr headsets?|gaming|consoles?|keyboards?|drones?|projectors?|e-?readers?|webcams?|doorbells?|smart (?:home|plugs?|speakers?)|bluetooth|wireless (?:earbuds?|headphones?|speakers?))\b/i },
  { slug: 'small-appliances', name: 'Kitchen and small appliances', plural: 'kitchen and small appliances', tech: true, blurb: 'Air fryers, pressure cookers, kettles, blenders, vacuums and other appliances.', test: /\b(?:air ?fryers?|pressure cookers?|multi-?cookers?|instant pot|blenders?|toasters?|kettles?|coffee ?(?:makers?|machines?)|microwaves?|slow cookers?|rice cookers?|juicers?|mixers?|waffle|griddles?|ovens?|dishwashers?|refrigerators?|freezers?|washers?|dryers?|vacuums?|irons?|food processors?|cookers?|fryers?|appliances?|hair dryers?|straighteners?|curling|shavers?|massagers?|blankets?|warmers?|steamers?|ranges?|cooktops?)\b/i },
  { slug: 'heating-cooling', name: 'Heaters, fans and air conditioners', plural: 'heaters, fans and air conditioners', blurb: 'Space heaters, fans, air conditioners, humidifiers, fireplaces and stoves.', test: /\b(?:heaters?|fans?|air conditioners?|furnaces?|fireplaces?|stoves?|humidifiers?|dehumidifiers?|air purifiers?|thermostats?|chimneys?|radiators?|fire ?pits?|patio heaters?|cooling)\b/i },
  { slug: 'lighting-electrical', name: 'Lighting and electrical', plural: 'lighting and electrical products', tech: true, blurb: 'Lamps, string lights, extension cords, power strips and wiring products.', test: /\b(?:lights?|lamps?|luminaires?|leds?|bulbs?|extension cords?|power strips?|surge protectors?|outlets?|switches|switch|cords?|cables?|wir(?:e|es|ing)|lanterns?|string lights?|christmas|ceiling|chandeliers?|sconces?|flashlights?|night ?lights?|plugs?)\b/i },
  { slug: 'tools-garden', name: 'Tools, lawn and garden', plural: 'tools, lawn and garden equipment', blurb: 'Power tools, mowers, trimmers, chainsaws, pressure washers and generators.', test: /\b(?:mowers?|trimmers?|chainsaws?|saws?|drills?|tools?|blowers?|pressure washers?|generators?|wrenches|wrench|ladders?|hedge|tillers?|snow ?blowers?|axes?|sanders?|grinders?|nail guns?|staplers?|hammers?|log splitters?|weed)\b/i },
  { slug: 'outdoor-sports', name: 'Sports, bikes and outdoor', plural: 'sports, bikes and outdoor products', blurb: 'Bicycles, helmets, ATVs, trampolines, grills, camping and fitness equipment.', test: /\b(?:bicycles?|bikes?|helmets?|atvs?|utvs?|side-?by-?sides?|snowmobiles?|golf|kayaks?|paddle|camp(?:ing)?|tents?|trampolines?|swim|pools?|fishing|skis?|snowboards?|skates?|fitness|treadmills?|exercise|weights?|dumbbells?|rifles?|guns?|archery|hunting|climbing|hammocks?|coolers?|grills?|smokers?|propane|scuba|boats?|pedals?|elliptical|rowing|vehicles?|tractors?|off-highway|playground|climbers?|swings?|slides?|resistance bands?|holsters?|handguns?|firearms?|zip ?lines?|go-?karts?|dirt bikes?|trailers?)\b/i },
  { slug: 'furniture', name: 'Furniture and home', plural: 'furniture and home products', blurb: 'Chairs, tables, dressers, beds, mattresses, shelves and other furniture.', test: /\b(?:chairs?|tables?|desks?|dressers?|chests?|beds?|mattress(?:es)?|sofas?|couch(?:es)?|bookcases?|shelf|shelves|shelving|cabinets?|bunk|stools?|benches|bench|futons?|wardrobes?|furniture|stands?|recliners?|ottomans?|loungers?|blinds|curtains?|rugs?|mirrors?)\b/i },
  { slug: 'clothing-accessories', name: 'Clothing and accessories', plural: 'clothing and accessories', blurb: 'Jackets, sleepwear, shoes, jewelry, bags and other wearables.', test: /\b(?:jackets?|hood(?:ie|ies)|sweatshirts?|pajamas?|sleepwear|robes?|shirts?|pants|shoes?|boots?|sandals?|scarves|scarf|hats?|gloves?|jewelry|necklaces?|bracelets?|rings?|costumes?|backpacks?|bags?|purses?|wallets?|sunglasses|drawstrings?|apparel|clothing|vests?|swimwear|socks?|slippers?|watch(?:es)?)\b/i },
  { slug: 'personal-care', name: 'Personal care and health', plural: 'personal care and health products', blurb: 'Essential oils, razors, cosmetics, medical devices and child-resistant packaging recalls.', test: /\b(?:essential oils?|oils?|lotions?|razors?|cosmetics?|sunscreens?|burn pads?|medical|alert devices?|hair|nail|beauty|e-?cig(?:arettes?)?|vap(?:e|es|ing)|nicotine|e-?liquids?|supplements?|gummies|medications?|ibuprofen|acetaminophen|first aid|thermometers?|skin|soap|shampoo|toothbrush(?:es)?|massage)\b/i },
  { slug: 'household', name: 'Candles and household goods', plural: 'candles and household goods', blurb: 'Candles, cookware, cups, bottles, cleaners and other household items.', test: /\b(?:candles?|cookware|pots?|pans?|cups?|mugs?|bottles?|tumblers?|glass(?:es|ware)?|knives|knife|containers?|lighters?|cleaners?|detergents?|bleach|vases?|decor|thermos|utensils?|dishes|plates?|bowls?|pitchers?|straws?|lunch|storage|hangers?|magnets?|glue|craft|knitting|needles|pens?|markers?|paints?|adhesives?|sealants?|torch(?:es)?|lighters?|boilers?|water heaters?|water treatment|valves?)\b/i },
];

export const OTHER_CATEGORY = { slug: 'other-products', name: 'Other consumer products', plural: 'other consumer products', blurb: 'Recalled products that do not fit another category.' };

export function classifyCategory(primary: string, fallback = ''): string {
  for (const text of [primary, fallback]) {
    if (!text) continue;
    for (const c of CATEGORIES) if (c.test.test(text)) return c.slug;
  }
  return OTHER_CATEGORY.slug;
}

// ---------- row building ----------

const dateOnly = (s: string) => clean(s).slice(0, 10);

function shortTitle(title: string): string {
  return clean(title.replace(/\b(?:due to|because of|because)\b.*$/i, '').replace(/[;,:\s-]+$/, ''));
}

function truncateWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).replace(/[\s,;:-]+$/, '');
}

function listUnique(values: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const c = clean(v);
    if (!c || /^none reported\.?$/i.test(c) || seen.has(c.toLowerCase())) continue;
    seen.add(c.toLowerCase());
    out.push(c);
  }
  return out;
}

/** Retailers carry both "Sold At:" text and the firm names. */
function splitRetailers(entries: { Name?: string }[]): { soldAt: string; firms: string[] } {
  const soldAt: string[] = [];
  const firms: string[] = [];
  for (const e of entries) {
    const raw = (e.Name ?? '').trim();
    if (!raw) continue;
    if (/^sold at\b/i.test(raw)) soldAt.push(clean(raw.replace(/^sold at:?\s*/i, '')));
    else firms.push(clean(raw));
  }
  return { soldAt: soldAt.join(' '), firms: listUnique(firms) };
}

function safeUrl(u: string | undefined): string {
  try {
    const url = new URL((u ?? '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

export function qualityScore(r: Pick<Recall, 'description' | 'hazards' | 'hazard_clause' | 'remedy' | 'units' | 'sold_at' | 'firms' | 'images' | 'products' | 'brand'>): number {
  let q = 0;
  if (r.description.length >= 200) q += 25;
  else if (r.description.length >= 150) q += 15;
  if (r.hazards.length || r.hazard_clause) q += 15;
  if (r.remedy.length >= 30) q += 15;
  if (r.units) q += 10;
  if (r.sold_at || r.firms.length) q += 10;
  if (r.images.length) q += 10;
  if (r.products.some((p) => p.name)) q += 10;
  if (r.brand) q += 5;
  return q;
}

export function toRecall(raw: CpscRecall): Recall {
  const title = clean(raw.Title);
  const number = clean(raw.RecallNumber);
  const date = dateOnly(raw.RecallDate);
  const manufacturers = listUnique((raw.Manufacturers ?? []).map((m) => m.Name));
  const brand = extractBrand(title, manufacturers);
  const clause = hazardClause(title);
  const hazardNames = listUnique((raw.Hazards ?? []).map((h) => h.Name));
  const products: ProductInfo[] = (raw.Products ?? [])
    .map((p) => ({ name: clean(p.Name), description: clean(p.Description), model: clean(p.Model), units: clean(p.NumberOfUnits) }))
    .filter((p) => p.name || p.description || p.model);
  const images: ImageInfo[] = (raw.Images ?? [])
    .map((i) => ({ url: safeUrl(i.URL), caption: clean(i.Caption) }))
    .filter((i) => i.url)
    .slice(0, 6);
  const { soldAt, firms } = splitRetailers(raw.Retailers ?? []);
  const unitsList = listUnique(products.map((p) => p.units));
  const short = shortTitle(title);
  const productNames = products.map((p) => p.name).join(' ');

  const recall: Recall = {
    id: raw.RecallID,
    number,
    date,
    last_publish: dateOnly(raw.LastPublishDate) || date,
    title,
    short_title: short || title,
    slug: `${number}-${slugify(truncateWords(short || title, 70))}`.replace(/-+$/, ''),
    description: clean(raw.Description),
    url: safeUrl(raw.URL),
    contact: clean(raw.ConsumerContact),
    brand,
    brand_slug: slugify(brand),
    category: classifyCategory(short, productNames),
    hazards: classifyHazards(hazardNames, clause),
    hazard_clause: clause,
    remedy: listUnique((raw.Remedies ?? []).map((r) => r.Name)).join(' '),
    remedy_options: listUnique((raw.RemedyOptions ?? []).map((o) => o.Option)),
    units: unitsList.join('; '),
    sold_at: soldAt,
    firms: listUnique([...firms, ...manufacturers, ...(raw.Importers ?? []).map((i) => i.Name), ...(raw.Distributors ?? []).map((d) => d.Name)]).slice(0, 8),
    countries: listUnique((raw.ManufacturerCountries ?? []).map((c) => c.Country)),
    injuries: listUnique((raw.Injuries ?? []).map((i) => i.Name)).join(' '),
    products,
    images,
    quality: 0,
    eligible: false,
    idx_rank: null,
  };
  recall.quality = qualityScore(recall);
  recall.eligible = Number(date.slice(0, 4)) >= FIRST_INDEXABLE_YEAR && recall.quality >= MIN_QUALITY && Boolean(recall.url);
  return recall;
}
