import { slugify } from '../derive.ts';
import { truncate } from '../html.ts';

export const FIRST_FOOD_YEAR = 2019;
export const MIN_FOOD_CHARS = 450;

/** One row of the openFDA food enforcement endpoint (only the fields we use). */
export interface FdaRow {
  recall_number?: string;
  event_id?: string;
  classification?: string;
  status?: string;
  recalling_firm?: string;
  city?: string;
  state?: string;
  country?: string;
  distribution_pattern?: string;
  product_description?: string;
  product_quantity?: string;
  reason_for_recall?: string;
  recall_initiation_date?: string;
  report_date?: string;
  code_info?: string;
  voluntary_mandated?: string;
}

export interface FoodProduct { description: string; quantity: string; code: string; recallNumber: string }

export interface FoodEvent {
  eventId: string;
  slug: string;
  title: string;
  firm: string;
  firmSlug: string;
  city: string;
  state: string;
  country: string;
  classification: 'I' | 'II' | 'III' | '';
  status: string;
  voluntary: string;
  reason: string;
  distribution: string;
  initiationDate: string;
  reportDate: string;
  products: FoodProduct[];
  hazards: string[];
  category: string;
  chars: number;
  eligible: boolean;
  idxRank: number | null;
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const NONE = /^(?:n\/?a|none|not available|unknown|-+)\.?$/i;

export const CLASS_INFO: Record<string, { label: string; meaning: string }> = {
  I: { label: 'Class I', meaning: 'FDA’s highest-risk class: a reasonable probability that using or being exposed to the product will cause serious adverse health consequences or death.' },
  II: { label: 'Class II', meaning: 'FDA’s middle class: use of the product may cause temporary or medically reversible adverse health consequences, or the chance of serious harm is remote.' },
  III: { label: 'Class III', meaning: 'FDA’s lowest-risk class: use of the product is not likely to cause adverse health consequences.' },
};

export const FOOD_HAZARDS: { slug: string; name: string; label: string; plural: string; test: RegExp; blurb: string }[] = [
  { slug: 'undeclared-allergens', name: 'Undeclared allergens', label: 'Allergen risk', plural: 'undeclared allergens', test: /undeclared|allergen|sulfite|may contain (?:milk|egg|wheat|soy|peanut|tree ?nut|fish|shellfish|sesame)/i, blurb: 'Foods that contain an allergen not listed on the label, such as milk, egg, wheat, soy, peanuts, tree nuts, fish, shellfish or sesame.' },
  { slug: 'listeria', name: 'Listeria', label: 'Listeria risk', plural: 'Listeria contamination', test: /listeria|monocytogenes/i, blurb: 'Foods that may be contaminated with Listeria monocytogenes.' },
  { slug: 'salmonella', name: 'Salmonella', label: 'Salmonella risk', plural: 'Salmonella contamination', test: /salmonella/i, blurb: 'Foods that may be contaminated with Salmonella.' },
  { slug: 'e-coli', name: 'E. coli', label: 'E. coli risk', plural: 'E. coli contamination', test: /e\.? ?coli|\bSTEC\b|shiga/i, blurb: 'Foods that may be contaminated with E. coli, including Shiga toxin-producing strains.' },
  { slug: 'botulism', name: 'Botulism', label: 'Botulism risk', plural: 'botulism risk', test: /botulinum|botulism/i, blurb: 'Foods that may support Clostridium botulinum growth, for example because of improper processing.' },
  { slug: 'foreign-material', name: 'Foreign material', label: 'Foreign object', plural: 'foreign material', test: /foreign|glass|metal|plastic|rubber|wood fragment|stone|fragments?/i, blurb: 'Foods that may contain pieces of glass, metal, plastic or other foreign material.' },
  { slug: 'other-contamination', name: 'Other contamination', label: 'Contamination', plural: 'other contamination', test: /contaminat|pathogen|bacteri|norovirus|hepatitis|cronobacter|lead\b|pesticide|aflatoxin|toxin|mold|mould|spoil/i, blurb: 'Contamination or spoilage other than the pathogens listed above, including mold, toxins and chemicals.' },
  { slug: 'labeling-quality', name: 'Labeling and quality', label: 'Label issue', plural: 'labeling and quality problems', test: /label|nutrition|misbrand|not (?:in )?compli|process(?:ing)? (?:control|deviation)|cgmp|adulterat/i, blurb: 'Labeling mistakes, nutrition facts errors and manufacturing process problems.' },
];

export const FOOD_CATEGORIES: { slug: string; name: string; plural: string; test: RegExp; blurb: string }[] = [
  { slug: 'supplements-infant', name: 'Supplements and infant formula', plural: 'supplements and infant formula', blurb: 'Dietary supplements, protein powders, vitamins and infant formula.', test: /supplement|vitamin|capsule|tablet|protein powder|infant formula|\bformula\b|probiotic|gummies|extract/i },
  { slug: 'seafood', name: 'Seafood', plural: 'seafood', blurb: 'Fish, shrimp, shellfish and seafood products.', test: /\bfish\b|salmon|tuna|shrimp|crab|oyster|clam|scallop|seafood|\bcod\b|tilapia|lobster|mussel|sardine|anchov|caviar|roe\b/i },
  { slug: 'candy-chocolate', name: 'Candy and chocolate', plural: 'candy and chocolate', blurb: 'Candy, chocolate, gummies and confectionery.', test: /candy|candies|chocolate|gumm(?:y|ies)|lollipop|caramel|confection|marshmallow|toffee|licorice/i },
  { slug: 'bakery-snacks', name: 'Bakery and snacks', plural: 'bakery products and snacks', blurb: 'Bread, cookies, crackers, chips, cereal, granola and snack foods.', test: /cookie|cracker|bread|\bbun\b|bagel|cake|muffin|\bchips?\b|pretzel|popcorn|granola|\bbars?\b|snack|cereal|tortilla|pastry|brownie|donut|doughnut|waffle|biscuit|pie\b/i },
  { slug: 'dairy', name: 'Dairy and eggs', plural: 'dairy and eggs', blurb: 'Cheese, milk, yogurt, ice cream, butter and eggs.', test: /cheese|\bmilk\b|yogurt|yoghurt|cream|butter|ice cream|dairy|kefir|\beggs?\b/i },
  { slug: 'meat-poultry', name: 'Meat and poultry', plural: 'meat and poultry products', blurb: 'Sausage, jerky, bacon and other meat products.', test: /sausage|jerky|bacon|chicken|beef|pork|turkey|\bham\b|salami|\bmeat/i },
  { slug: 'nuts-seeds', name: 'Nuts, seeds and dried fruit', plural: 'nuts, seeds and dried fruit', blurb: 'Nuts, nut butters, seeds, trail mix and dried fruit.', test: /\bnuts?\b|almond|pecan|walnut|cashew|pistachio|peanut|\bseeds?\b|trail mix|tahini|dried (?:fruit|mango|apricot|cranberr)|raisin|date\b/i },
  { slug: 'beverages', name: 'Beverages', plural: 'beverages', blurb: 'Juice, tea, coffee, water, smoothies and other drinks.', test: /juice|drink|\btea\b|coffee|\bwater\b|soda|beverage|smoothie|kombucha|lemonade|energy|cider|\bwine\b/i },
  { slug: 'fresh-produce', name: 'Fresh produce', plural: 'fresh produce', blurb: 'Fresh and packaged fruit, vegetables, salads, sprouts and herbs.', test: /lettuce|spinach|cucumber|tomato|pepper|onion|cabbage|kale|\bsalad\b|sprout|cantaloupe|melon|berr(?:y|ies)|apple|peach|mango|avocado|celery|carrot|broccoli|cauliflower|mushroom|cilantro|basil|parsley|produce|vegetable|\bfruit/i },
  { slug: 'prepared-meals', name: 'Prepared meals', plural: 'prepared meals and deli foods', blurb: 'Sandwiches, salads, soups, deli foods and ready-to-eat meals.', test: /sandwich|wrap|burrito|\bmeals?\b|soup|pizza|\bbowl|entree|dumpling|tamale|taco|pasta|lasagna|noodle|deli|\bdip\b|hummus|guacamole|salsa|sushi|ready[- ]to[- ]eat|frozen/i },
  { slug: 'sauces-spices', name: 'Sauces, spices and pantry', plural: 'sauces, spices and pantry foods', blurb: 'Spices, seasoning, sauces, oils, honey, flour and other pantry items.', test: /spice|seasoning|sauce|dressing|\bpaste\b|syrup|honey|\boil\b|vinegar|\bsalt\b|\bmix\b|flour|sugar|jam|jelly|spread|marinade|ketchup|mustard|powder/i },
];

export const OTHER_FOOD = { slug: 'other-food', name: 'Other foods', plural: 'other foods', blurb: 'Food products that do not fit another category.' };

export const foodCategoryInfo = (slug: string) => FOOD_CATEGORIES.find((c) => c.slug === slug) ?? (slug === OTHER_FOOD.slug ? { ...OTHER_FOOD, test: /$^/ } : undefined);
export const foodHazardInfo = (slug: string) => FOOD_HAZARDS.find((h) => h.slug === slug);

export function classifyFoodHazards(reason: string): string[] {
  const out = FOOD_HAZARDS.filter((h) => h.test.test(reason)).map((h) => h.slug);
  // "Undeclared" wording also appears with pathogens; keep the specific pathogens first.
  return out.length ? out : ['labeling-quality'];
}

export function classifyFoodCategory(descriptions: string[]): string {
  const text = descriptions.slice(0, 3).join(' ');
  for (const c of FOOD_CATEGORIES) if (c.test.test(text)) return c.slug;
  return OTHER_FOOD.slug;
}

const SUFFIX = /[,\s]+(?:inc\.?|incorporated|llc|l\.l\.c\.?|ltd\.?|limited|co\.?|corp\.?|corporation|company|lp|l\.p\.)\.?$/i;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase()).replace(/\b(Llc|Lp|Usa|Dba)\b/g, (m) => m.toUpperCase());
}

/** `FRESH IDEATION FOOD GROUP, LLC dba Fresh Creative Cuisine` → `Fresh Creative Cuisine`. */
export function normalizeFirm(raw: string): string {
  let f = clean(raw);
  const dba = f.match(/\b(?:d\/b\/a|dba|doing business as)\s+(.+)$/i);
  if (dba?.[1]) f = dba[1];
  for (let i = 0; i < 3; i++) f = f.replace(SUFFIX, '').trim();
  f = f.replace(/[,.;:]+$/, '').trim();
  return f === f.toUpperCase() && /[A-Z]{3}/.test(f) ? titleCase(f) : f;
}

export function isoFdaDate(raw: string | undefined): string {
  const m = clean(raw).match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function shortProduct(desc: string): string {
  const text = clean(desc);
  const parts = text.split(/,\s|;\s|\s-\s|\s\(|\sNet\s|\d+(?:\.\d+)?\s?(?:oz|lb|lbs|g|kg|ml|ct|count|pk|pack)\b/i).map((p) => p.trim()).filter((p) => p.length >= 3);
  return truncate(parts[0] ?? text, 70);
}

export function toFoodEvent(rows: FdaRow[]): FoodEvent | null {
  const first = rows[0];
  const eventId = clean(first?.event_id);
  if (!first || !eventId || !rows.some((r) => clean(r.product_description))) return null;
  const firm = normalizeFirm(first.recalling_firm ?? '');
  const reason = clean(first.reason_for_recall);
  const cls = clean(first.classification).replace(/^class\s+/i, '') as FoodEvent['classification'];
  const seen = new Set<string>();
  const products: FoodProduct[] = [];
  for (const r of rows) {
    const description = clean(r.product_description);
    if (!description) continue;
    const key = description.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const code = clean(r.code_info);
    products.push({ description, quantity: NONE.test(clean(r.product_quantity)) ? '' : clean(r.product_quantity), code: NONE.test(code) ? '' : code, recallNumber: clean(r.recall_number) });
  }
  const hazards = classifyFoodHazards(reason);
  const category = classifyFoodCategory(products.map((p) => p.description));
  const reportDate = isoFdaDate(first.report_date);
  const distribution = NONE.test(clean(first.distribution_pattern)) ? '' : clean(first.distribution_pattern);
  const chars = reason.length + distribution.length + products.reduce((n, p) => n + p.description.length + p.code.length + p.quantity.length, 0);
  const lead = shortProduct(products[0]?.description ?? '');
  const more = products.length > 1 ? ` and ${products.length - 1} more` : '';
  const label = foodHazardInfo(hazards[0] ?? '')?.label ?? 'Recall';
  const title = `${firm || 'A company'} recalls ${lead}${more}: ${label.toLowerCase()}`;
  const year = Number(reportDate.slice(0, 4));
  return {
    eventId,
    slug: `${eventId}-${slugify(`${firm} ${lead}`).slice(0, 70).replace(/-+$/, '')}`,
    title, firm, firmSlug: slugify(firm), city: clean(first.city), state: clean(first.state), country: clean(first.country),
    classification: ['I', 'II', 'III'].includes(cls) ? cls : '', status: clean(first.status), voluntary: clean(first.voluntary_mandated), reason, distribution,
    initiationDate: isoFdaDate(first.recall_initiation_date), reportDate, products, hazards, category, chars,
    eligible: year >= FIRST_FOOD_YEAR && chars >= MIN_FOOD_CHARS && reason.length >= 25 && ['I', 'II', 'III'].includes(cls) && Boolean(reportDate),
    idxRank: null,
  };
}

export function groupRows(rows: FdaRow[]): FoodEvent[] {
  const byEvent = new Map<string, FdaRow[]>();
  for (const r of rows) {
    const id = clean(r.event_id);
    if (!id) continue;
    const list = byEvent.get(id) ?? [];
    list.push(r);
    byEvent.set(id, list);
  }
  return [...byEvent.values()].map(toFoodEvent).filter((e): e is FoodEvent => e !== null);
}
