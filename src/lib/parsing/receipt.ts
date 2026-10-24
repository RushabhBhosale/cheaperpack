/**
 * Turns OCR output from a shop receipt into line items, totals, tax and
 * discounts. Receipts vary a lot, so the result says what it couldn't
 * reconcile instead of silently trusting every number.
 */

import { roundMoney } from '../calculations/money';

/** A piece of text the OCR engine found, with its box in image pixels. */
export interface OcrBox {
  text: string;
  score?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Joins boxes that sit on the same printed line, left to right. */
export function groupRows(boxes: OcrBox[]): string[] {
  const sorted = boxes.filter((b) => b.text.trim()).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: { center: number; height: number; boxes: OcrBox[] }[] = [];
  for (const b of sorted) {
    const center = b.y + b.h / 2;
    const row = rows.at(-1);
    if (row && Math.abs(center - row.center) <= Math.max(row.height, b.h) * 0.5) {
      row.boxes.push(b);
      row.center = (row.center * (row.boxes.length - 1) + center) / row.boxes.length;
      row.height = Math.max(row.height, b.h);
    } else {
      rows.push({ center, height: b.h, boxes: [b] });
    }
  }
  return rows.map((r) =>
    r.boxes
      .sort((a, b) => a.x - b.x)
      .map((b) => b.text.trim())
      .join('  '),
  );
}

// ---------------------------------------------------------------- categories

export const RECEIPT_CATEGORIES = [
  'Groceries',
  'Fruit & veg',
  'Dairy & eggs',
  'Meat & fish',
  'Snacks & drinks',
  'Household',
  'Personal care',
  'Eating out',
  'Other',
] as const;
export type ReceiptCategory = (typeof RECEIPT_CATEGORIES)[number];

const CATEGORY_WORDS: [ReceiptCategory, RegExp][] = [
  ['Dairy & eggs', /\b(milk|curd|dahi|paneer|cheese|butter|ghee|yogh?urt|cream|eggs?|lassi|buttermilk)\b/i],
  ['Fruit & veg', /\b(apple|banana|orange|mango|grapes?|lemon|onion|potato|tomato|carrot|cabbage|spinach|palak|capsicum|cucumber|garlic|ginger|coriander|chilli|peas|beans|fruit|veg|vegetables?|salad|lettuce|avocado|berries)\b/i],
  ['Meat & fish', /\b(chicken|mutton|fish|prawns?|beef|pork|lamb|meat|sausage|bacon|ham|salmon|tuna)\b/i],
  ['Snacks & drinks', /\b(chips|crisps|biscuits?|cookies?|chocolate|namkeen|snacks?|juice|cola|soda|coke|pepsi|sprite|water|tea|coffee|beer|wine|drink|soft drink|candy|wafers?|cake|ice ?cream|noodles|maggi)\b/i],
  ['Household', /\b(detergent|surf|ariel|tide|vim|harpic|lizol|cleaner|soap bar|dishwash|tissue|toilet|paper|foil|garbage|bags?|bulb|battery|batteries|mop|broom|phenyl|bleach)\b/i],
  ['Personal care', /\b(shampoo|conditioner|toothpaste|toothbrush|soap|body ?wash|face ?wash|lotion|cream|deo|deodorant|razor|sanitary|pads|diapers?|colgate|dettol|lifebuoy|dove|nivea|perfume)\b/i],
  ['Eating out', /\b(meal|burger|pizza|sandwich|thali|biryani|dosa|combo|starter|main course|dessert|latte|cappuccino|tip)\b/i],
  ['Groceries', /\b(rice|atta|flour|dal|lentils?|sugar|salt|oil|masala|spice|pasta|bread|cereal|oats|poha|sooji|rava|besan|maida|jaggery|honey|jam|ketchup|sauce|pickle|grocery)\b/i],
];

// Allow simple plurals: "bananas", "tomatoes".
const CATEGORY_PATTERNS = CATEGORY_WORDS.map(([cat, re]) => [cat, new RegExp(re.source.replace(/\)\\b$/, ')(?:e?s)?\\b'), 'i')] as const);

export function guessCategory(name: string): ReceiptCategory {
  for (const [cat, re] of CATEGORY_PATTERNS) if (re.test(name)) return cat;
  return 'Other';
}

// ---------------------------------------------------------------- parsing

export interface ReceiptItem {
  name: string;
  amount: number;
  qty?: number;
  category: ReceiptCategory;
}

export interface ParsedReceipt {
  store?: string;
  /** yyyy-mm-dd when a date was found. */
  date?: string;
  items: ReceiptItem[];
  itemsSum: number;
  total?: number;
  subtotal?: number;
  tax: number;
  discount: number;
  /** Things the shopper should check. */
  warnings: string[];
}

const TOTAL = /\b(grand\s*total|net\s*(?:amt|amount|total|payable|bill)|total\s*(?:amount|amt|payable|due|rs\.?|inr)?|amount\s*(?:due|payable)|bill\s*(?:amt|amount|total)|to\s*pay|balance\s*due)\b/i;
const STRONG_TOTAL = /\b(grand\s*total|net\s*(?:amt|amount|payable|total|bill)|amount\s*payable|to\s*pay|total\s*payable)\b/i;
const SUBTOTAL = /\bsub\s*-?\s*total\b/i;
const TAX = /\b(c\s?gst|s\s?gst|i\s?gst|ut\s?gst|gst|vat|tax(?:es)?|cess|service\s*(?:charge|tax))\b/i;
const DISCOUNT = /\b(discount|disc\.?|savings?|you\s*saved?|coupon|promo|less)\b/i;
const PAYMENT = /\b(cash|card|upi|paid|change|tender(?:ed)?|visa|master\s*card|rupay|paytm|g\s?pay|phone\s?pe|amex|credit|debit|refund|balance|round(?:ing|ed)?\s*(?:off)?|returned)\b/i;
const META = /\b(gstin|gst\s*no|tin|phone|ph\.?|tel|mob(?:ile)?|cashier|counter|table|token|order\s*no|invoice\s*no|bill\s*no|receipt\s*no|thank|visit|www|http|fssai|pan|cin|hsn|sac|terminal|txn|auth|approval)\b/i;

const AMOUNT_DECIMAL = /(-?)\s*(?:[₹$€£]|rs\.?)?\s*(\d{1,3}(?:,\d{2,3})+\.\d{2}|\d+\.\d{2})\s*(?:[A-Z*]{1,2})?\s*$/i;
const AMOUNT_INTEGER = /(-?)\s*(?:[₹$€£]|rs\.?)?\s*(\d{1,3}(?:,\d{3})+|\d{1,6})\s*(?:[A-Z*]{1,2})?\s*$/i;

const toNumber = (s: string) => Number(s.replace(/,/g, ''));

function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s;
}

function trailingAmount(row: string, allowInteger: boolean): { amount: number; negative: boolean; rest: string } | null {
  const m = row.match(AMOUNT_DECIMAL) ?? (allowInteger ? row.match(AMOUNT_INTEGER) : null);
  if (!m) return null;
  const rest = row.slice(0, m.index).trim();
  return { amount: toNumber(m[2]!), negative: m[1] === '-' || /-\s*$/.test(rest), rest };
}

function cleanItemName(rest: string): { name: string; qty?: number } {
  let text = rest;
  let qty: number | undefined;
  // "2 x 45.00", "2 @ 45"
  const times = text.match(/(\d+(?:\.\d+)?)\s*[x×@*]\s*(?:[₹$€£]|rs\.?)?\s*\d+(?:[.,]\d+)?\s*$/i);
  if (times) {
    qty = Number(times[1]);
    text = text.slice(0, times.index).trim();
  } else {
    // Columns: name  qty  rate
    const cols = text.match(/\s(\d{1,3}(?:\.\d+)?)\s+\d+(?:[.,]\d{1,2})?\s*$/);
    if (cols) {
      qty = Number(cols[1]);
      text = text.slice(0, cols.index).trim();
    }
  }
  const name = text
    .replace(/\b\d{5,}\b/g, ' ') // item codes, HSN
    .replace(/^[\d\s.)#-]+(?=\p{L})/u, '') // leading line numbers
    .replace(/[|*_=]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s:.-]+$/, '')
    .trim();
  return { name: titleCase(name).slice(0, 60), qty: qty && qty > 0 && qty < 1000 ? qty : undefined };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function findDate(text: string): string | undefined {
  const pad = (n: number) => String(n).padStart(2, '0');
  const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
  let m = text.match(/\b(20\d\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m && valid(+m[1]!, +m[2]!, +m[3]!)) return `${m[1]}-${pad(+m[2]!)}-${pad(+m[3]!)}`;
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    // Day first, as on most receipts outside the US.
    if (valid(y, +m[2]!, +m[1]!)) return `${y}-${pad(+m[2]!)}-${pad(+m[1]!)}`;
  }
  m = text.match(/\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]*(20\d\d|\d{2})\b/i);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    const mo = MONTHS.indexOf(m[2]!.toLowerCase()) + 1;
    if (valid(y, mo, +m[1]!)) return `${y}-${pad(mo)}-${pad(+m[1]!)}`;
  }
  return undefined;
}

export function parseReceipt(rows: string[]): ParsedReceipt {
  const lines = rows.map((r) => r.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const run = (allowInteger: boolean) => {
    const items: ReceiptItem[] = [];
    const totals: { amount: number; strong: boolean }[] = [];
    let subtotal: number | undefined;
    let tax = 0;
    let discount = 0;
    for (const line of lines) {
      const found = trailingAmount(line, allowInteger);
      if (!found) continue;
      const lower = line.toLowerCase();
      if (SUBTOTAL.test(lower)) subtotal = found.amount;
      else if (TOTAL.test(lower) && !TAX.test(lower)) totals.push({ amount: found.amount, strong: STRONG_TOTAL.test(lower) });
      else if (TAX.test(lower)) tax += found.amount;
      else if (DISCOUNT.test(lower) || found.negative) discount += found.amount;
      else if (PAYMENT.test(lower) || META.test(lower)) continue;
      else {
        const { name, qty } = cleanItemName(found.rest);
        if ((name.match(/\p{L}/gu) ?? []).length < 2) continue;
        items.push({ name, amount: found.amount, qty, category: guessCategory(name) });
      }
    }
    return { items, totals, subtotal, tax: roundMoney(tax), discount: roundMoney(discount) };
  };

  let r = run(false);
  // Some receipts print whole amounts only; fall back to integers if decimals found nothing.
  if (r.items.length === 0) r = run(true);

  const strong = r.totals.filter((t) => t.strong);
  const total = (strong.length ? strong : r.totals).at(-1)?.amount;
  const itemsSum = roundMoney(r.items.reduce((t, i) => t + i.amount, 0));

  const warnings: string[] = [];
  if (r.items.length === 0) warnings.push('No line items could be read. Add them below, or check the recognised text.');
  if (total !== undefined && r.items.length) {
    const expected = roundMoney(itemsSum + r.tax - r.discount);
    const alt = roundMoney(itemsSum - r.discount); // prices that already include tax
    const close = (a: number) => Math.abs(a - total) <= Math.max(1, total * 0.01);
    if (!close(expected) && !close(alt) && !close(itemsSum)) {
      warnings.push(`The items add up to ${itemsSum.toFixed(2)}, but the receipt total says ${total.toFixed(2)}. Some items may be missing or misread.`);
    }
  }
  if (total === undefined && r.items.length) warnings.push('No total was found on the receipt, so the items haven’t been checked against it.');

  // Store name: the first wordy line at the top that isn't a label.
  const store = lines
    .slice(0, 5)
    .find((l) => (l.match(/\p{L}/gu) ?? []).length >= 3 && !trailingAmount(l, false) && !META.test(l) && !/\b(tax\s*invoice|invoice|receipt|bill)\b/i.test(l));

  return {
    store: store ? titleCase(store).slice(0, 60) : undefined,
    date: findDate(lines.join('\n')),
    items: r.items,
    itemsSum,
    total,
    subtotal: r.subtotal,
    tax: r.tax,
    discount: r.discount,
    warnings,
  };
}
