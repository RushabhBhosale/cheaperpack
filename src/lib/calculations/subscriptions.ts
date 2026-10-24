/**
 * Recurring subscriptions: monthly and yearly equivalents, biggest costs,
 * savings from cancelling, renewal dates and annual-vs-monthly plans.
 */

import { cheaperBy, roundMoney } from './money';

export type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export const CYCLES: Cycle[] = ['monthly', 'quarterly', 'yearly', 'weekly'];
/** Length of each billing cycle in months. */
export const CYCLE_MONTHS: Record<Cycle, number> = { weekly: 12 / 52, monthly: 1, quarterly: 3, yearly: 12 };

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  cycle: Cycle;
  category?: string;
  /** ISO date (yyyy-mm-dd) of a renewal, past or future. */
  renewal?: string;
  /** Marked as a candidate to cancel. */
  cancel?: boolean;
}

export const monthlyCost = (s: Pick<Subscription, 'amount' | 'cycle'>) => s.amount / CYCLE_MONTHS[s.cycle];
export const yearlyCost = (s: Pick<Subscription, 'amount' | 'cycle'>) => monthlyCost(s) * 12;

export interface SubscriptionSummary {
  monthly: number;
  yearly: number;
  /** Most expensive first, by monthly equivalent. */
  ranked: (Subscription & { monthly: number; yearly: number; share: number })[];
  byCategory: { category: string; monthly: number; share: number }[];
  cancelMonthly: number;
  cancelYearly: number;
  cancelCount: number;
}

export function summarise(subs: Subscription[]): SubscriptionSummary {
  const monthly = subs.reduce((t, s) => t + monthlyCost(s), 0);
  const ranked = subs
    .map((s) => ({ ...s, monthly: monthlyCost(s), yearly: yearlyCost(s), share: monthly > 0 ? monthlyCost(s) / monthly : 0 }))
    .sort((a, b) => b.monthly - a.monthly);
  const cats = new Map<string, number>();
  for (const s of subs) {
    const c = s.category?.trim() || 'Other';
    cats.set(c, (cats.get(c) ?? 0) + monthlyCost(s));
  }
  const byCategory = [...cats]
    .map(([category, m]) => ({ category, monthly: roundMoney(m), share: monthly > 0 ? m / monthly : 0 }))
    .sort((a, b) => b.monthly - a.monthly);
  const cancelled = subs.filter((s) => s.cancel);
  const cancelMonthly = cancelled.reduce((t, s) => t + monthlyCost(s), 0);
  return {
    monthly: roundMoney(monthly),
    yearly: roundMoney(monthly * 12),
    ranked,
    byCategory,
    cancelMonthly: roundMoney(cancelMonthly),
    cancelYearly: roundMoney(cancelMonthly * 12),
    cancelCount: cancelled.length,
  };
}

/** Next renewal on or after `today`, rolling a past date forward by whole cycles. */
export function nextRenewal(isoDate: string, cycle: Cycle, today: Date): Date | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(start.getTime())) return null;
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(start);
  const step = () => {
    if (cycle === 'weekly') d.setDate(d.getDate() + 7);
    else {
      const months = CYCLE_MONTHS[cycle];
      const target = d.getMonth() + months;
      const dom = start.getDate();
      d.setDate(1);
      d.setMonth(target);
      // Keep the original day of month where it exists (31 Jan → 28/29 Feb → 31 Mar).
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dom, last));
    }
  };
  for (let i = 0; d < day && i < 5000; i++) step();
  return d;
}

export interface PlanComparison {
  monthlyForYear: number;
  annual: number;
  saving: number;
  savingFraction: number;
  /** Months of the monthly plan the annual price pays for. */
  breakEvenMonths: number;
}

export function compareAnnualPlan(monthlyPrice: number, annualPrice: number): PlanComparison {
  const monthlyForYear = roundMoney(monthlyPrice * 12);
  return {
    monthlyForYear,
    annual: annualPrice,
    saving: roundMoney(monthlyForYear - annualPrice),
    savingFraction: cheaperBy(annualPrice, monthlyForYear),
    breakEvenMonths: annualPrice / monthlyPrice,
  };
}
