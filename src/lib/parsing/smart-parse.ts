/**
 * Deterministic extraction of products (price + quantity + name) from free
 * text such as "2kg powder for 210 and 1.5kg for 189", and from the lines an
 * OCR engine reads off a price tag.
 *
 * No guessing beyond what the text supports: amounts are only treated as
 * prices or quantities when the surrounding words or symbols say so, and
 * anything ambiguous is returned as an alternative for the shopper to pick.
 */

import { parseDecimal } from './parse';

export type SmartUnit = 'g' | 'kg' | 'ml' | 'cl' | 'l' | 'item' | 'oz' | 'lb' | 'floz_us' | 'gal_us';
export type CurrencyHint = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface QuantityMention {
  amount: number;
  unit: SmartUnit;
  /** Multipack factors, e.g. [6, 330] for "6 x 330 ml". */
  factors: number[];
  start: number;
  end: number;
  /** "net" when labelled Net Qty / Net Wt; "ref" for "per 100 g" style references. */
  label?: 'net' | 'ref' | 'serving';
}

export type PriceKind = 'offer' | 'plain' | 'mrp' | 'unitPrice' | 'discount';
/** strong: currency symbol or price label; medium: "for 210", "@ 210", "199.00"; weak: a bare number. */
export type PriceStrength = 'strong' | 'medium' | 'weak';

export interface PriceMention {
  value: number;
  start: number;
  end: number;
  kind: PriceKind;
  strength: PriceStrength;
  currency?: CurrencyHint;
}

export interface PriceOption {
  value: number;
  kind: PriceKind;
}

export interface SmartProduct {
  name: string;
  price?: number;
  quantity?: number;
  unit?: SmartUnit;
  factors: number[];
  /** Other prices seen for this product, e.g. the MRP when an offer price was chosen. */
  otherPrices: PriceOption[];
}

export interface SmartParseResult {
  products: SmartProduct[];
  currency?: CurrencyHint;
}

// ---------------------------------------------------------------- vocabulary

const NUM = String.raw`(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:[.,]\d+)?|[.,]\d+)`;
const FRACTION = String.raw`([1-9])\/([2-9]|1[0-6])`;

const UNIT_WORDS: [SmartUnit, number, string][] = [
  // "fl oz" must be tried before "oz". Fluid ounces are taken as US fluid ounces.
  ['floz_us', 1, String.raw`fl\.?\s?oz|fluid\s?ounces?`],
  ['oz', 1, String.raw`oz|ounces?`],
  ['lb', 1, String.raw`lbs?|pounds?`],
  ['gal_us', 1, String.raw`gals?|gallons?`],
  ['cl', 1, String.raw`cl`],
  ['kg', 1, String.raw`kgs?|kilos?|kilo\s?grams?|kilogrammes?`],
  ['g', 1, String.raw`gms?|grms?|grams?|grammes?|gr|g`],
  ['g', 0.001, String.raw`mg|milligrams?`],
  ['ml', 1, String.raw`mls?|millilit(?:re|er)s?|ml`],
  ['l', 1, String.raw`ltrs?|lts?|lit(?:re|er)s?|l`],
  ['item', 1, String.raw`pcs|pc|pieces?|nos|units?|items?|count|ct|eggs?|tablets?|tabs|capsules?|sachets?|bags?|rolls?|bars?|bottles?|cans?|pouches|pouch|packets?|pkts?|packs?|sheets?`],
];
const UNIT = UNIT_WORDS.map(([, , re]) => re).join('|');
/** A unit must not run straight into another letter ("1 l" yes, "1 lb" no). */
const END = String.raw`(?![a-z])`;
const MEASURE_UNIT = UNIT_WORDS.filter(([u]) => u !== 'item').map(([, , re]) => re).join('|');
const CONTAINER = String.raw`packs?|pouch(?:es)?|bottles?|cans?|pcs|pieces?|packets?|pkts?|boxes|box|bags?|jars?|tins?|tubs?`;

function unitOf(word: string): { unit: SmartUnit; scale: number } | undefined {
  const w = word.replace(/\s+/g, '');
  for (const [unit, scale, re] of UNIT_WORDS) {
    if (new RegExp(`^(?:${re})$`).test(w)) return { unit, scale };
  }
  return undefined;
}

function num(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const r = parseDecimal(s, '.');
  return r.ok ? r.value : undefined;
}

const CURRENCY_PREFIX = String.raw`₹|rs\.?|inr|rupees?|\$|us\$|usd|€|eur|£|gbp`;
const CURRENCY_SUFFIX = String.raw`₹|rs\.?|inr|rupees?|\/-|\$|usd|€|eur|£|gbp`;
const PRICE_LABEL = String.raw`m\.?\s?r\.?\s?p\.?|mrp|offer\s+price|our\s+price|sale\s+price|special\s+price|deal\s+price|selling\s+price|best\s+price|price|offer|sale|deal|now|only|you\s+pay`;
const SOFT_LABEL = String.raw`for|at|@|=|costs?|costing|priced\s+at`;

function currencyOf(token: string | undefined): CurrencyHint | undefined {
  if (!token) return undefined;
  const t = token.toLowerCase();
  if (/₹|rs|inr|rupee|\/-/.test(t)) return 'INR';
  if (/\$|usd/.test(t)) return 'USD';
  if (/€|eur/.test(t)) return 'EUR';
  if (/£|gbp/.test(t)) return 'GBP';
  return undefined;
}

function labelKind(label: string | undefined): PriceKind {
  if (!label) return 'plain';
  const l = label.replace(/[\s.]/g, '');
  if (l === 'mrp') return 'mrp';
  if (/offer|sale|deal|special|our|selling|best|now|only|youpay/.test(l)) return 'offer';
  return 'plain';
}

// ---------------------------------------------------------------- normalisation

/**
 * Lower-cases and swaps look-alike characters one-for-one, so that positions
 * in the normalised text map straight back to the original (for names).
 */
function normalise(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped =
      ch === '×' || ch === '✕' || ch === '✖' ? 'x' : ch === '–' || ch === '—' ? '-' : ch === ' ' ? ' ' : lower;
    // Keep length identical: fall back to a placeholder if lower-casing changed it.
    out += mapped.length === ch.length ? mapped : ch.length === 1 ? '?' : '??';
  }
  return out;
}

/** Common OCR slips inside numbers: O→0, l/I/|→1 between digits. */
export function fixOcrDigits(line: string): string {
  return line
    .replace(/(?<=\d)[oO](?=[\d.,]|\s*(?:g|kg|ml|l)\b)/g, '0')
    .replace(/(?<=[\d.,])[oO](?=\d)/g, '0')
    .replace(/(?<=\d)[lI|](?=\d)/g, '1')
    .replace(/(?<=[₹$€£]\s?)[lI|](?=\d)/g, '1');
}

// ---------------------------------------------------------------- mention finding

interface Span {
  start: number;
  end: number;
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

function findQuantities(s: string): QuantityMention[] {
  const found: QuantityMention[] = [];
  const add = (m: RegExpMatchArray, amount: number | undefined, unit: SmartUnit | undefined, factors: number[] = []) => {
    if (amount === undefined || !unit || !(amount > 0)) return;
    const span = { start: m.index!, end: m.index! + m[0].length };
    if (found.some((f) => overlaps(f, span))) return;
    found.push({ amount, unit, factors, ...span });
  };

  // "6 x 330 ml", "2 packs of 500 g", "3 bottles x 1 l"
  for (const m of s.matchAll(new RegExp(String.raw`\b${NUM}\s*(?:(?:${CONTAINER})\s*(?:of|x)?|x)\s*${NUM}\s*(${MEASURE_UNIT})${END}`, 'g'))) {
    const n = num(m[1]);
    const size = num(m[2]);
    const u = unitOf(m[3]!);
    if (n && size && u && Number.isInteger(n) && n <= 1000) add(m, n * size * u.scale, u.unit, [n, size * u.scale]);
  }
  // "330 ml x 6"
  for (const m of s.matchAll(new RegExp(String.raw`\b${NUM}\s*(${MEASURE_UNIT})\s*x\s*(\d{1,3})(?![\d.,]|\s*(?:${UNIT})${END})`, 'g'))) {
    const size = num(m[1]);
    const u = unitOf(m[2]!);
    const n = num(m[3]);
    if (n && size && u && n <= 1000) add(m, n * size * u.scale, u.unit, [n, size * u.scale]);
  }
  // "half dozen", "2 dozen", "dozen"
  for (const m of s.matchAll(/\b(half\s+(?:a\s+)?|\d+\s*)?dozens?\b/g)) {
    const lead = m[1]?.trim();
    const n = !lead ? 1 : lead.startsWith('half') ? 0.5 : num(lead);
    if (n) add(m, n * 12, 'item');
  }
  // "pack of 6", "set of 4", "box of 12"
  for (const m of s.matchAll(new RegExp(String.raw`\b(?:pack|set|box|combo|bundle)\s+of\s+(\d+)(?!\s*(?:x|${MEASURE_UNIT})${END})`, 'g'))) {
    add(m, num(m[1]), 'item');
  }
  // "1/2 kg", "½ kg"
  for (const m of s.matchAll(new RegExp(String.raw`(?<![\w.,/₹$€£])${FRACTION}\s*(${MEASURE_UNIT})${END}`, 'g'))) {
    const a = num(m[1]);
    const b = num(m[2]);
    const u = unitOf(m[3]!);
    if (a && b && u) add(m, (a / b) * u.scale, u.unit);
  }
  for (const m of s.matchAll(new RegExp(String.raw`(\d*)\s*([½¼¾])\s*(${MEASURE_UNIT})${END}`, 'g'))) {
    const frac = { '½': 0.5, '¼': 0.25, '¾': 0.75 }[m[2] as '½' | '¼' | '¾'];
    const u = unitOf(m[3]!);
    if (u) add(m, ((num(m[1]) ?? 0) + frac) * u.scale, u.unit);
  }
  // "500 g", "1.5kg", "6 pcs"
  for (const m of s.matchAll(new RegExp(String.raw`(?<![\w.,])${NUM}\s*(${UNIT})${END}`, 'g'))) {
    const u = unitOf(m[2]!);
    const n = num(m[1]);
    if (u && n !== undefined) add(m, n * u.scale, u.unit);
  }

  // Labels from the words just before each quantity.
  for (const q of found) {
    const before = s.slice(Math.max(0, q.start - 24), q.start);
    if (/(?:\bper|\bevery|\beach)\s*$/.test(before) || /(?:(?:₹|rs\.?|\$|€|£)\s*[\d.,]+\s*|[\d.,]+)\/\s*$/.test(before)) q.label = 'ref';
    else if (/\bserv(?:ing|e)s?(?:\s*size)?\s*[:\-]?\s*(?:\(?\s*)?$/.test(before)) q.label = 'serving';
    else if (/\bnet\s*(?:qty|quantity|wt\.?|weight|vol\.?|volume|contents?|content|mass)?\s*[:.\-]?\s*$/.test(before)) q.label = 'net';
    const after = s.slice(q.end, q.end + 6);
    if (q.label !== 'ref' && /^\s*(?:serving|portion)/.test(after)) q.label = 'serving';
  }
  return found.sort((a, b) => a.start - b.start);
}

function findPrices(s: string, taken: Span[], ocr: boolean): PriceMention[] {
  const found: PriceMention[] = [];
  const isTaken = (span: Span) => taken.some((t) => overlaps(t, span)) || found.some((f) => overlaps(f, span));
  const push = (start: number, end: number, valueText: string, kind: PriceKind, strength: PriceStrength, currency?: CurrencyHint) => {
    const value = num(valueText);
    if (value === undefined || value <= 0) return;
    const span = { start, end };
    if (isTaken(span)) return;
    found.push({ value, start, end, kind, strength, currency });
  };

  const notUnitAfter = String.raw`(?!\d|[.,]\d|\s*(?:${UNIT})${END}|\s*%|\s*x\s*\d)`;

  // "MRP ₹249", "Offer price: Rs. 199", "price 120"
  for (const m of s.matchAll(new RegExp(String.raw`\b(${PRICE_LABEL})\s*[:\-]?\s*(${CURRENCY_PREFIX})?\s*${NUM}${notUnitAfter}(?:\s*(?:\/-))?`, 'g'))) {
    push(m.index!, m.index! + m[0].length, m[3]!, labelKind(m[1]), 'strong', currencyOf(m[2]) ?? currencyOf(m[0]));
  }
  // "₹199", "Rs. 1,299.00", "$3.49"
  for (const m of s.matchAll(new RegExp(String.raw`(?:^|(?<=[^a-z]))(${CURRENCY_PREFIX})\s*[:\-]?\s*${NUM}${notUnitAfter}(?:\s*\/-)?`, 'g'))) {
    push(m.index!, m.index! + m[0].length, m[2]!, 'plain', 'strong', currencyOf(m[1]));
  }
  // "199/-", "210 rs", "3.49$"
  for (const m of s.matchAll(new RegExp(String.raw`(?<![\w.,])${NUM}\s*(${CURRENCY_SUFFIX})(?![a-z])`, 'g'))) {
    push(m.index!, m.index! + m[0].length, m[1]!, 'plain', 'strong', currencyOf(m[2]));
  }
  // "for 210", "@ 45", "= 189"
  for (const m of s.matchAll(new RegExp(String.raw`(?:^|(?<=[^a-z]))(${SOFT_LABEL})(?![a-z])\s*[:\-]?\s*${NUM}${notUnitAfter}`, 'g'))) {
    push(m.index!, m.index! + m[0].length, m[2]!, 'plain', 'medium');
  }
  // Bare numbers: weak candidates (medium on a price tag when written like 199.00).
  for (const m of s.matchAll(new RegExp(String.raw`(?<![\w.,/:$€£₹-])${NUM}(?!\w|[.,]\d|[%/:]|\s*%|\s*(?:${UNIT})${END}|\s*x\s*\d)`, 'g'))) {
    const text = m[1]!;
    const value = num(text);
    if (value === undefined) continue;
    const digits = text.replace(/\D/g, '');
    if (digits.length > 7) continue;
    if (/^(19|20)\d\d$/.test(text)) continue; // a year
    const strength: PriceStrength = ocr && /[.,]\d\d$/.test(text) ? 'medium' : 'weak';
    push(m.index!, m.index! + m[0].length, text, 'plain', strength);
  }

  // Reclassify unit prices ("₹39.80/100 g", "₹64 per kg") and discounts ("save ₹30", "₹50 off").
  for (const p of found) {
    const after = s.slice(p.end, p.end + 18);
    const before = s.slice(Math.max(0, p.start - 16), p.start);
    // "/" means "per" right after a price; " / " after a bare number is a list separator.
    const slash = p.strength === 'strong' ? String.raw`\s*\/` : String.raw`\/`;
    if (new RegExp(String.raw`^(?:${slash}|\s*(?:per|a)\b)\s*(?:${NUM}\s*)?(?:${UNIT})${END}`).test(after)) p.kind = 'unitPrice';
    else if (/^\s*(?:off|discount|cashback|less)\b/.test(after) || /(?:save|saving|savings|off|discount|cashback|upto|up to|extra)\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*$/.test(before)) {
      p.kind = 'discount';
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** "3 for 99" / "2 @ 50": a multi-buy count right before a price. */
function findMultiBuy(s: string, prices: PriceMention[], quantities: Span[]): Map<PriceMention, { count: number; span: Span }> {
  const out = new Map<PriceMention, { count: number; span: Span }>();
  for (const p of prices) {
    const before = s.slice(0, p.start);
    const m = before.match(/(?<![\w.,])(\d{1,2})\s*$/);
    const word = s.slice(p.start, p.end).match(/^(for|@|at)\b/);
    if (m && word) {
      const count = Number(m[1]);
      const span = { start: before.length - m[0].length, end: p.start };
      if (count >= 2 && count <= 24 && !quantities.some((q) => overlaps(q, span))) out.set(p, { count, span });
    }
  }
  return out;
}

// ---------------------------------------------------------------- choosing

const STRENGTH_RANK: Record<PriceStrength, number> = { strong: 3, medium: 2, weak: 1 };
const KIND_RANK: Partial<Record<PriceKind, number>> = { offer: 3, plain: 2, mrp: 1 };

const usable = (p: PriceMention) => p.kind !== 'unitPrice' && p.kind !== 'discount';

/**
 * Picks the price a shopper would pay: a labelled offer beats a plain price,
 * which beats an MRP; stronger evidence beats weaker. On a tag with several
 * unlabelled prices the lowest wins (the other is usually a struck-out MRP).
 */
export function choosePrice(candidates: PriceMention[], preferLowest: boolean): { chosen?: PriceMention; others: PriceOption[] } {
  const list = candidates.filter(usable);
  if (list.length === 0) return { others: [] };
  const sorted = [...list].sort(
    (a, b) =>
      STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength] ||
      (KIND_RANK[b.kind] ?? 0) - (KIND_RANK[a.kind] ?? 0) ||
      (preferLowest ? a.value - b.value : a.start - b.start),
  );
  const chosen = sorted[0]!;
  const others: PriceOption[] = [];
  for (const p of sorted.slice(1)) {
    if (p.value !== chosen.value && !others.some((o) => o.value === p.value)) others.push({ value: p.value, kind: p.kind });
  }
  return { chosen, others };
}

// ---------------------------------------------------------------- names

/** Names that say nothing on their own. */
const GENERIC = new Set(['pack', 'packs', 'one', 'bag', 'bottle', 'packet', 'pouch', 'item', 'it', 'the pack', 'the one']);

const FILLER = new Set(
  'and vs versus or the a an is are of for at rs rs. inr rupees price prices mrp offer sale only cost costs costing each per x = - : / | , . then also with total buy get worth approx around about respectively compare which cheaper better one two save off discount cashback upto extra flat i we my saw got found bought seen it this that'.split(
    ' ',
  ),
);

function cleanName(original: string, spans: Span[], from: number, to: number): string {
  let chars = original.slice(from, to).split('');
  for (const sp of spans) {
    for (let i = Math.max(sp.start, from); i < Math.min(sp.end, to); i++) chars[i - from] = ' ';
  }
  const words = chars
    .join('')
    .replace(/\d+(?:[.,]\d+)?\s*%\s*(?:off)?/gi, ' ')
    .replace(new RegExp(String.raw`(?:per|\/)\s*(?:\d+\s*)?(?:${UNIT})${END}`, 'gi'), ' ')
    .replace(/[|,;:=@()[\]{}"“”'‘’*#!?₹$€£]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (words.length && FILLER.has(words[0]!.toLowerCase())) words.shift();
  while (words.length && FILLER.has(words.at(-1)!.toLowerCase())) words.pop();
  const name = words.filter((w) => !/^[\d.,/-]+$/.test(w)).join(' ').slice(0, 40).trim();
  return GENERIC.has(name.toLowerCase()) ? '' : name;
}

// ---------------------------------------------------------------- free text

const SEPARATOR = /\n+|;|\|| and | vs\.? | versus | or | then |,\s+|,(?=[^\d])| \/ /g;

interface Segment extends Span {
  qs: QuantityMention[];
  ps: PriceMention[];
}

/**
 * Reads products from free text such as
 *   "2kg powder for 210 and 1.5kg for 189"
 *   "Rs 210 - 2kg | Rs 189 - 1.5kg"
 *   "milk 500ml 28 / 1L 54"
 *   "2 kg and 1.5 kg cost 210 and 189"
 */
export function parseShoppingText(text: string): SmartParseResult {
  const s = normalise(text);
  const everyQ = findQuantities(s);
  const allQs = everyQ.filter((q) => q.label !== 'ref');
  const pricesFound = findPrices(s, everyQ, false);
  const multiBuys = findMultiBuy(s, pricesFound, everyQ);
  const countSpans = [...multiBuys.values()].map((m) => m.span);
  // The "3" in "3 for 99" is a count, not a price.
  const allPs = pricesFound.filter((p) => !countSpans.some((c) => overlaps(c, p)));
  const ps = allPs.filter(usable);
  const currency = allPs.find((p) => p.currency)?.currency;

  const spans: Span[] = [...everyQ, ...allPs, ...countSpans];
  const products: SmartProduct[] = [];
  const makeProduct = (q: QuantityMention | undefined, cands: PriceMention[], from: number, to: number): SmartProduct => {
    const { chosen, others } = choosePrice(cands, false);
    const multi = chosen ? multiBuys.get(chosen) : undefined;
    let quantity = q?.amount;
    let factors = q?.factors ?? [];
    let unit = q?.unit;
    if (multi) {
      if (q) {
        factors = [multi.count, ...(q.factors.length ? q.factors.slice(1) : [q.amount])];
        quantity = q.amount * multi.count;
      } else {
        quantity = multi.count;
        unit = 'item';
      }
    }
    return { name: cleanName(text, spans, from, to), price: chosen?.value, quantity, unit, factors, otherPrices: others };
  };

  // "2 kg and 1.5 kg cost 210 and 189": all sizes first, then all prices (or the reverse).
  const n = allQs.length;
  for (const candidates of [ps.filter((p) => p.strength !== 'weak'), ps]) {
    if (n < 2 || candidates.length !== n) continue;
    const order = [...allQs.map((q) => ({ t: 'q', at: q.start })), ...candidates.map((p) => ({ t: 'p', at: p.start }))]
      .sort((a, b) => a.at - b.at)
      .map((x) => x.t)
      .join('');
    if (order === 'q'.repeat(n) + 'p'.repeat(n) || order === 'p'.repeat(n) + 'q'.repeat(n)) {
      allQs.forEach((q, i) => products.push(makeProduct(q, [candidates[i]!], i === 0 ? 0 : q.start, q.end)));
      return { products, currency };
    }
  }

  // Split into segments at separators that aren't inside a mention.
  const cuts: Span[] = [];
  for (const m of s.matchAll(SEPARATOR)) {
    const cut = { start: m.index!, end: m.index! + m[0].length };
    if (!spans.some((sp) => overlaps(sp, cut))) cuts.push(cut);
  }
  let segments: Segment[] = [];
  let pos = 0;
  for (const cut of [...cuts, { start: s.length, end: s.length }]) {
    if (cut.start > pos) segments.push({ start: pos, end: cut.start, qs: [], ps: [] });
    pos = cut.end;
  }
  for (const seg of segments) {
    seg.qs = allQs.filter((q) => q.start >= seg.start && q.end <= seg.end);
    seg.ps = allPs.filter((p) => p.start >= seg.start && p.end <= seg.end);
  }

  // Merge: text-only segments into the next one (names like "salt and pepper"),
  // and a size-only segment followed by a price-only one ("2kg powder, 210").
  const merged: Segment[] = [];
  for (const seg of segments) {
    const prev = merged.at(-1);
    const hasQ = seg.qs.length > 0;
    const hasP = seg.ps.some(usable);
    const prevHasQ = !!prev && prev.qs.length > 0;
    const prevHasP = !!prev && prev.ps.some(usable);
    if (prev && ((!prevHasQ && !prevHasP) || (prevHasQ && !prevHasP && hasP && !hasQ) || (!prevHasQ && prevHasP && hasQ && !hasP))) {
      prev.end = seg.end;
      prev.qs.push(...seg.qs);
      prev.ps.push(...seg.ps);
    } else {
      merged.push({ ...seg, qs: [...seg.qs], ps: [...seg.ps] });
    }
  }
  segments = merged;

  for (const seg of segments) {
    const segPs = seg.ps.filter(usable);
    if (seg.qs.length === 0) {
      // A price on its own (or a multi-buy like "6 for 42") is still worth a row.
      const { chosen } = choosePrice(segPs, false);
      if (chosen && (chosen.strength === 'strong' || multiBuys.has(chosen))) products.push(makeProduct(undefined, segPs, seg.start, seg.end));
      continue;
    }
    if (seg.qs.length === 1) {
      products.push(makeProduct(seg.qs[0], segPs, seg.start, seg.end));
      continue;
    }
    // Several sizes in one segment: each price belongs to the size it follows
    // ("2kg 210 1.5kg 189") or, if the text starts with a price, the size after it.
    const first = [...seg.qs, ...segPs].sort((a, b) => a.start - b.start)[0]!;
    const priceFirst = segPs.includes(first as PriceMention);
    const groups = seg.qs.map(() => [] as PriceMention[]);
    for (const p of segPs) {
      let idx: number;
      if (priceFirst) {
        idx = seg.qs.findIndex((q) => q.start > p.start);
        if (idx === -1) idx = seg.qs.length - 1;
      } else {
        idx = seg.qs.findLastIndex((q) => q.end <= p.start);
        if (idx === -1) idx = 0;
      }
      groups[idx]!.push(p);
    }
    // Name text: for "name size price" lists, words after a product's last
    // price belong to the next product.
    const groupEnd = (i: number) => Math.max(seg.qs[i]!.end, ...groups[i]!.map((p) => p.end));
    seg.qs.forEach((q, i) => {
      const last = i === seg.qs.length - 1;
      const from = i === 0 ? seg.start : priceFirst ? seg.qs[i - 1]!.end : groupEnd(i - 1);
      const to = last ? seg.end : priceFirst ? q.end : groupEnd(i);
      products.push(makeProduct(q, groups[i]!, from, to));
    });
  }

  return { products: products.filter((p) => p.price !== undefined || p.quantity !== undefined), currency };
}

// ---------------------------------------------------------------- price tags (OCR)

export interface OcrLine {
  text: string;
  /** Recognition confidence, 0–1. */
  score?: number;
  /** Text height in pixels; the product name is usually the largest text. */
  height?: number;
}

export interface TagParseResult {
  product: SmartProduct;
  currency?: CurrencyHint;
  /** Every distinct usable price found, for quick correction. */
  priceOptions: PriceOption[];
  /** Every distinct quantity found. */
  quantityOptions: { quantity: number; unit: SmartUnit }[];
}

const NOT_A_NAME =
  /\b(mrp|m\.r\.p|price|rs\.?|inr|net|qty|quantity|wt|weight|mfg|mfd|exp|expiry|best before|use by|batch|b\.?\s?no|lot|pkd|packed|incl|tax|taxes|customer|care|www|http|fssai|lic|licen[cs]e|manufactured|marketed|address|ingredients?|nutrition|energy|protein|fat|carbohydrates?|sugars?|sodium|store|keep|offer|save|off|discount|kcal|per|serving|barcode|email|phone|tel|toll|made in|country|origin|date|valid)\b/i;

const NOT_A_PRICE_LINE =
  /care|phone|tel\b|toll|call|batch|lot\b|b\.?\s?no|months?|days?|years?|best before|use by|mfd|mfg|exp|fssai|lic|pin\b|code|www|@|serving|energy|kcal|protein|fat|carb|sugar|sodium|%/i;

/**
 * Reads a single product from the text lines of a price tag or package.
 * Prefers labelled values ("Net Qty 500 g", "Offer ₹199") and never takes the
 * first number by default; anything else found is returned as an option.
 */
export function parsePriceTag(lines: OcrLine[]): TagParseResult {
  const cleaned = lines.map((l) => fixOcrDigits(l.text.trim()));
  const text = cleaned.filter(Boolean).join('\n');
  const s = normalise(text);

  const qs = findQuantities(s);
  const productQs = qs.filter((q) => q.label !== 'ref' && q.label !== 'serving');
  const ps = findPrices(s, qs, true);
  const usablePs = ps.filter(usable);

  // Quantity: labelled net quantity, else the most frequent, else the largest.
  let q = productQs.find((x) => x.label === 'net');
  if (!q && productQs.length) {
    const key = (x: QuantityMention) => `${x.unit}:${x.amount}`;
    const counts = new Map<string, number>();
    for (const x of productQs) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1);
    q = [...productQs].sort((a, b) => (counts.get(key(b)) ?? 0) - (counts.get(key(a)) ?? 0) || b.amount - a.amount)[0];
  }

  // Price: never a weak bare number automatically; those are only offered as options.
  const { chosen, others } = choosePrice(
    usablePs.filter((p) => p.strength !== 'weak'),
    true,
  );
  // Bare numbers are only offered as alternatives, and not from lines that are
  // clearly about something else (phone numbers, batch codes, shelf life).
  const lineOf = (pos: number) => s.slice(s.lastIndexOf('\n', pos - 1) + 1, (s.indexOf('\n', pos) + 1 || s.length + 1) - 1);
  const weakOptions = usablePs
    .filter((p) => p.strength === 'weak' && !NOT_A_PRICE_LINE.test(lineOf(p.start)))
    .map((p) => ({ value: p.value, kind: p.kind }));
  const priceOptions: PriceOption[] = [];
  for (const o of [...(chosen ? [{ value: chosen.value, kind: chosen.kind }] : []), ...others, ...weakOptions]) {
    if (!priceOptions.some((x) => x.value === o.value)) priceOptions.push(o);
  }

  // Name: the largest name-like text when sizes are known, otherwise the
  // first name-like line (brand and product usually come first).
  const nameLines = lines
    .map((l, i) => ({ ...l, text: cleaned[i] ?? '', index: i }))
    .filter((l) => {
      if (!l.text || NOT_A_NAME.test(l.text)) return false;
      const letters = (l.text.match(/\p{L}/gu) ?? []).length;
      return letters >= 3 && letters / l.text.replace(/\s/g, '').length >= 0.7;
    });
  const sized = nameLines.filter((l) => l.height);
  const best = sized.length
    ? sized.reduce((a, b) => ((b.height ?? 0) * (b.score ?? 1) > (a.height ?? 0) * (a.score ?? 1) ? b : a))
    : nameLines[0];
  let name = best?.text ?? '';
  if (name === name.toUpperCase()) name = name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  name = name.replace(/\s+/g, ' ').slice(0, 40).trim();

  const quantityOptions: { quantity: number; unit: SmartUnit }[] = [];
  for (const x of productQs) {
    if (!quantityOptions.some((o) => o.quantity === x.amount && o.unit === x.unit)) quantityOptions.push({ quantity: x.amount, unit: x.unit });
  }

  return {
    product: {
      name,
      price: chosen?.value,
      quantity: q?.amount,
      unit: q?.unit,
      factors: q?.factors ?? [],
      otherPrices: priceOptions.filter((o) => o.value !== chosen?.value),
    },
    currency: (chosen?.currency ?? ps.find((p) => p.currency)?.currency) as CurrencyHint | undefined,
    priceOptions,
    quantityOptions,
  };
}
