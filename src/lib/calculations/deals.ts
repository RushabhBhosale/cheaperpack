/**
 * Promotional offers: percentage and flat discounts, coupons, stacked
 * discounts, buy X get Y, delivery and (capped) cashback.
 *
 * Distinguishes what you pay at checkout from cashback that arrives later
 * and the effective cost once it does.
 */

import { cheaperBy, roundMoney } from './money';

export type AmountKind = 'percent' | 'fixed';

export interface Discount {
  kind: AmountKind;
  value: number;
  /** Largest discount a percentage can give, e.g. "20% off up to ₹100". */
  cap?: number;
  label?: string;
}

export interface Cashback {
  kind: AmountKind;
  value: number;
  /** Largest cashback a percentage can give. */
  cap?: number;
}

export interface DealInput {
  name?: string;
  /** Price of one item before any offer. */
  price: number;
  /** Items you pay for. */
  quantity: number;
  /** Buy X get Y free: X items paid earns Y free items. */
  buyGet?: { buy: number; get: number };
  discounts: Discount[];
  /** sequential: each discount applies to the price left after the previous one. original: each applies to the original price. */
  stacking: 'sequential' | 'original';
  delivery: number;
  cashback?: Cashback;
}

export interface DealStep {
  label: string;
  amount: number;
}

export interface DealResult {
  itemsPaid: number;
  itemsReceived: number;
  /** Price × items paid. */
  subtotal: number;
  /** What the items received would cost without any offer. */
  fullValue: number;
  discountSteps: DealStep[];
  discountTotal: number;
  afterDiscounts: number;
  delivery: number;
  /** Paid at checkout. */
  checkout: number;
  /** Credited later. */
  cashback: number;
  /** Checkout minus cashback. */
  effective: number;
  effectivePerItem: number;
  /** Saving against paying full price for everything received (plus the same delivery). */
  saving: number;
  savingFraction: number;
}

function amountOf(kind: AmountKind, value: number, base: number, cap?: number): number {
  let amount = kind === 'percent' ? (base * value) / 100 : value;
  if (kind === 'percent' && cap !== undefined && cap >= 0) amount = Math.min(amount, cap);
  return roundMoney(Math.max(0, amount));
}

function describe(d: Discount): string {
  if (d.label) return d.label;
  if (d.kind === 'fixed') return 'Flat discount';
  return d.cap !== undefined ? `${d.value}% off (up to the cap)` : `${d.value}% off`;
}

export function calculateDeal(input: DealInput): DealResult {
  const itemsPaid = input.quantity;
  const free = input.buyGet && input.buyGet.buy > 0 ? Math.floor(itemsPaid / input.buyGet.buy) * input.buyGet.get : 0;
  const itemsReceived = itemsPaid + free;
  const subtotal = roundMoney(input.price * itemsPaid);
  const fullValue = roundMoney(input.price * itemsReceived);

  const steps: DealStep[] = [];
  let running = subtotal;
  if (input.stacking === 'sequential') {
    for (const d of input.discounts) {
      const amount = Math.min(amountOf(d.kind, d.value, running, d.cap), running);
      running = roundMoney(running - amount);
      steps.push({ label: describe(d), amount });
    }
  } else {
    let total = 0;
    for (const d of input.discounts) {
      const amount = amountOf(d.kind, d.value, subtotal, d.cap);
      steps.push({ label: describe(d), amount });
      total += amount;
    }
    running = roundMoney(Math.max(0, subtotal - total));
  }
  const afterDiscounts = running;
  const discountTotal = roundMoney(subtotal - afterDiscounts);
  const delivery = roundMoney(Math.max(0, input.delivery));
  const checkout = roundMoney(afterDiscounts + delivery);

  // Cashback is worked out on the order value after discounts, not on delivery.
  const cashback = input.cashback ? Math.min(amountOf(input.cashback.kind, input.cashback.value, afterDiscounts, input.cashback.cap), checkout) : 0;
  const effective = roundMoney(checkout - cashback);
  const saving = roundMoney(fullValue + delivery - effective);

  return {
    itemsPaid,
    itemsReceived,
    subtotal,
    fullValue,
    discountSteps: steps,
    discountTotal,
    afterDiscounts,
    delivery,
    checkout,
    cashback,
    effective,
    effectivePerItem: itemsReceived > 0 ? effective / itemsReceived : effective,
    saving,
    savingFraction: fullValue + delivery > 0 ? saving / (fullValue + delivery) : 0,
  };
}

export interface DealComparison {
  results: DealResult[];
  /** True when deals give different numbers of items, so they're ranked per item. */
  perItem: boolean;
  /** Indices of the cheapest deal(s). */
  best: number[];
  /** Index of the cheapest deal that isn't best, if any. */
  runnerUp?: number;
  /** How much the runner-up costs more (per item when perItem). */
  difference: number;
  differenceFraction: number;
}

export function compareDeals(inputs: DealInput[]): DealComparison {
  const results = inputs.map(calculateDeal);
  const perItem = new Set(results.map((r) => r.itemsReceived)).size > 1;
  const cost = (r: DealResult) => (perItem ? r.effectivePerItem : r.effective);
  const min = Math.min(...results.map(cost));
  const tol = 0.005;
  const best = results.map((r, i) => (cost(r) - min <= tol ? i : -1)).filter((i) => i >= 0);
  const others = results.map((r, i) => i).filter((i) => !best.includes(i)).sort((a, b) => cost(results[a]!) - cost(results[b]!));
  const runnerUp = others[0];
  const difference = runnerUp === undefined ? 0 : cost(results[runnerUp]!) - min;
  return {
    results,
    perItem,
    best,
    runnerUp,
    difference: perItem ? difference : roundMoney(difference),
    differenceFraction: runnerUp === undefined ? 0 : cheaperBy(min, cost(results[runnerUp]!)),
  };
}
