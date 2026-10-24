/**
 * Paying upfront vs EMI (equated monthly instalments) on a reducing-balance
 * loan, including down payment, fees, cash discounts and "no-cost EMI"
 * discounts that offset the interest.
 */

import { roundMoney } from './money';

export interface EmiInput {
  price: number;
  downPayment: number;
  /** Annual interest rate in percent. */
  annualRate: number;
  months: number;
  processingFee: number;
  otherCharges: number;
  /** Discount available only when paying in full upfront. */
  cashDiscount: number;
  /** Discount given with a "no-cost EMI" offer, reducing the amount financed. */
  noCostDiscount: number;
}

/** Monthly instalment on a reducing-balance loan. */
export function emiAmount(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  const f = (1 + r) ** months;
  return (principal * r * f) / (f - 1);
}

export interface EmiResult {
  cashTotal: number;
  financed: number;
  emi: number;
  totalInstalments: number;
  interest: number;
  /** Interest left after a no-cost discount (0 when fully offset). */
  netInterest: number;
  fees: number;
  emiTotal: number;
  /** EMI total minus cash total: positive means EMI costs more. */
  extraVsCash: number;
  /** Yearly rate that makes the instalments and fees worth the cash price today; null when undefined. */
  effectiveAnnualRate: number | null;
  schedule: { month: number; interest: number; principal: number; balance: number }[];
}

/**
 * Finds the monthly rate r where upfront + Σ emi/(1+r)^k equals the cash price.
 * That is what borrowing really costs once fees and lost discounts are counted.
 */
function effectiveRate(cashTotal: number, upfront: number, emi: number, months: number): number | null {
  const financedValue = cashTotal - upfront;
  if (financedValue <= 0 || emi <= 0) return null;
  const pv = (r: number) => (r === 0 ? emi * months : (emi * (1 - (1 + r) ** -months)) / r);
  if (pv(0) <= financedValue) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > financedValue) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

export function calculateEmi(input: EmiInput): EmiResult {
  const cashTotal = roundMoney(input.price - input.cashDiscount);
  const financed = roundMoney(Math.max(0, input.price - input.downPayment - input.noCostDiscount));
  const exact = emiAmount(financed, input.annualRate, input.months);
  const emi = roundMoney(exact);
  const totalInstalments = roundMoney(emi * input.months);
  const interest = roundMoney(Math.max(0, totalInstalments - financed));
  const fees = roundMoney(input.processingFee + input.otherCharges);
  const emiTotal = roundMoney(input.downPayment + totalInstalments + fees);

  const schedule: EmiResult['schedule'] = [];
  let balance = financed;
  const r = input.annualRate / 12 / 100;
  for (let m = 1; m <= input.months; m++) {
    const i = roundMoney(balance * r);
    const p = m === input.months ? balance : roundMoney(emi - i);
    balance = roundMoney(balance - p);
    schedule.push({ month: m, interest: i, principal: p, balance: Math.max(0, balance) });
  }

  return {
    cashTotal,
    financed,
    emi,
    totalInstalments,
    interest,
    netInterest: roundMoney(Math.max(0, interest - input.noCostDiscount)),
    fees,
    emiTotal,
    extraVsCash: roundMoney(emiTotal - cashTotal),
    effectiveAnnualRate: effectiveRate(cashTotal, input.downPayment + fees, emi, input.months),
    schedule,
  };
}
