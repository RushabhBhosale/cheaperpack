/**
 * Cost per use: what owning something really costs each time it's used.
 */

import { cheaperBy, roundMoney } from './money';

export interface UseItem {
  name?: string;
  price: number;
  uses: number;
  maintenance: number;
  resale: number;
}

export interface UseResult {
  total: number;
  perUse: number;
}

export function costPerUse(item: UseItem): UseResult {
  const total = roundMoney(Math.max(0, item.price + item.maintenance - item.resale));
  return { total, perUse: item.uses > 0 ? total / item.uses : Infinity };
}

export function compareCostPerUse(items: UseItem[]) {
  const results = items.map(costPerUse);
  const min = Math.min(...results.map((r) => r.perUse));
  const best = results.map((r, i) => (Math.abs(r.perUse - min) < 1e-9 ? i : -1)).filter((i) => i >= 0);
  const others = results.map((_, i) => i).filter((i) => !best.includes(i)).sort((a, b) => results[a]!.perUse - results[b]!.perUse);
  const runnerUp = others[0];
  return {
    results,
    best,
    runnerUp,
    cheaperBy: runnerUp === undefined ? 0 : cheaperBy(min, results[runnerUp]!.perUse),
  };
}
