/**
 * Shopping budget: totals, what's left and what's been bought.
 */

import { roundMoney } from './money';

export interface BudgetItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  purchased: boolean;
}

export const lineTotal = (i: Pick<BudgetItem, 'qty' | 'price'>) => roundMoney(i.qty * i.price);

export interface BudgetSummary {
  total: number;
  purchasedTotal: number;
  remainingToBuy: number;
  /** Budget minus the planned total; negative when over budget. */
  left: number;
  over: boolean;
  usedFraction: number;
  count: number;
  purchasedCount: number;
}

export function summariseBudget(budget: number | undefined, items: BudgetItem[]): BudgetSummary {
  const total = roundMoney(items.reduce((t, i) => t + lineTotal(i), 0));
  const purchasedTotal = roundMoney(items.filter((i) => i.purchased).reduce((t, i) => t + lineTotal(i), 0));
  const left = budget === undefined ? 0 : roundMoney(budget - total);
  return {
    total,
    purchasedTotal,
    remainingToBuy: roundMoney(total - purchasedTotal),
    left,
    over: budget !== undefined && total > budget,
    usedFraction: budget ? total / budget : 0,
    count: items.length,
    purchasedCount: items.filter((i) => i.purchased).length,
  };
}

/** Plain-text list for sharing or copying. */
export function listToText(name: string, items: BudgetItem[], money: (v: number) => string, budget?: number): string {
  const lines = items.map((i) => `${i.purchased ? '✓' : '•'} ${i.name}${i.qty !== 1 ? ` × ${i.qty}` : ''} — ${money(lineTotal(i))}`);
  const s = summariseBudget(budget, items);
  const footer = [`Total: ${money(s.total)}`];
  if (budget !== undefined) footer.push(`Budget: ${money(budget)}`, s.over ? `Over by: ${money(-s.left)}` : `Left: ${money(s.left)}`);
  return [name, '', ...lines, '', ...footer].join('\n');
}

/** CSV with a header row; fields are quoted. */
export function listToCsv(items: BudgetItem[]): string {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [['Item', 'Quantity', 'Price', 'Total', 'Bought'].map(q).join(','), ...items.map((i) => [i.name, i.qty, i.price, lineTotal(i), i.purchased ? 'yes' : 'no'].map(q).join(','))].join('\n');
}

/**
 * Reads one shopping-list entry typed in a single box:
 *   "Milk 2 x 32"  → 2 at 32 each      "Bread 45 x2" → 2 at 45 each
 *   "Rice 5kg 450" → 1 at 450 (5kg stays in the name)
 *   "Oil"          → name only; the price can be added later.
 */
export function parseBudgetEntry(text: string, localeDecimal: '.' | ',' = '.'): { name: string; qty: number; price?: number } {
  const t = text.trim().replace(/\s+/g, ' ');
  const money = String.raw`(?:₹|rs\.?|\$|€|£)?\s*(\d+(?:[.,]\d{1,2})?)`;
  const toNum = (s: string) => Number(localeDecimal === ',' ? s.replace(',', '.') : s.replace(',', '.'));
  // "45 x2": an x stuck to the last number marks a quantity.
  let m = t.match(new RegExp(String.raw`^(.*?)\s+${money}\s+[x×*](\d{1,3})$`, 'i'));
  if (m && m[1]) return { name: m[1].trim(), qty: Number(m[3]), price: toNum(m[2]!) };
  m = t.match(new RegExp(String.raw`^(.*?)\s+(\d{1,3})\s*[x×*]\s*${money}$`, 'i'));
  if (m && m[1]) return { name: m[1].trim(), qty: Number(m[2]), price: toNum(m[3]!) };
  m = t.match(new RegExp(String.raw`^(.*?)\s+${money}\s*[x×*]\s*(\d{1,3})$`, 'i'));
  if (m && m[1]) return { name: m[1].trim(), qty: Number(m[3]), price: toNum(m[2]!) };
  m = t.match(new RegExp(String.raw`^(.*\S)\s+${money}$`, 'i'));
  if (m && /\p{L}/u.test(m[1]!)) return { name: m[1]!.trim(), qty: 1, price: toNum(m[2]!) };
  return { name: t, qty: 1 };
}
