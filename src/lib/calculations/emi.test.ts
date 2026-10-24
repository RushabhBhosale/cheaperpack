import { describe, expect, it } from 'vitest';
import { calculateEmi, emiAmount, type EmiInput } from './emi';

const base: EmiInput = { price: 100000, downPayment: 0, annualRate: 12, months: 12, processingFee: 0, otherCharges: 0, cashDiscount: 0, noCostDiscount: 0 };

describe('EMI', () => {
  it('matches the standard reducing-balance formula', () => {
    expect(emiAmount(100000, 12, 12)).toBeCloseTo(8884.88, 2);
    expect(emiAmount(500000, 9, 60)).toBeCloseTo(10379.18, 2);
    expect(emiAmount(12000, 0, 12)).toBe(1000);
    expect(emiAmount(0, 12, 12)).toBe(0);
  });

  it('totals interest, fees and the difference from paying upfront', () => {
    const r = calculateEmi({ ...base, processingFee: 999, otherCharges: 100 });
    expect(r.emi).toBe(8884.88);
    expect(r.totalInstalments).toBe(106618.56);
    expect(r.interest).toBe(6618.56);
    expect(r.fees).toBe(1099);
    expect(r.emiTotal).toBe(107717.56);
    expect(r.extraVsCash).toBe(7717.56);
    expect(r.schedule).toHaveLength(12);
    expect(r.schedule[0]!.interest).toBe(1000);
    expect(r.schedule.at(-1)!.balance).toBe(0);
  });

  it('includes the down payment', () => {
    const r = calculateEmi({ ...base, downPayment: 20000 });
    expect(r.financed).toBe(80000);
    expect(r.emiTotal).toBeCloseTo(20000 + r.totalInstalments, 6);
  });

  it('shows that a no-cost EMI can still cost more than paying upfront', () => {
    // Interest is offset by the no-cost discount, but a fee is charged and the cash discount is lost.
    const r = calculateEmi({ price: 60000, downPayment: 0, annualRate: 0, months: 6, processingFee: 199, otherCharges: 0, cashDiscount: 3000, noCostDiscount: 0 });
    expect(r.interest).toBe(0);
    expect(r.extraVsCash).toBe(3199);
    expect(r.effectiveAnnualRate).toBeGreaterThan(15);
    const offset = calculateEmi({ price: 30000, downPayment: 0, annualRate: 15, months: 6, processingFee: 0, otherCharges: 0, cashDiscount: 0, noCostDiscount: 1300 });
    expect(offset.financed).toBe(28700);
    expect(offset.netInterest).toBeLessThan(offset.interest);
  });

  it('reports zero cost for a genuinely free instalment plan', () => {
    const r = calculateEmi({ ...base, annualRate: 0 });
    expect(r).toMatchObject({ emi: 8333.33, interest: 0, extraVsCash: -0.04 });
    expect(r.effectiveAnnualRate).toBe(0);
  });
});
