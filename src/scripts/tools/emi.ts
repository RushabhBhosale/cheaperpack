import { calculateEmi } from '../../lib/calculations/emi';
import { money, num } from '../../lib/ui/currency';
import { $, h } from '../../lib/ui/dom';
import { FormReader, field, readForm, writeForm } from '../../lib/ui/fields';
import { empty, notice, showWhy, stats, verdict } from '../../lib/ui/render';
import { mountTool } from '../../lib/ui/tool';

type State = Record<string, string>;
const root = $('[data-tool]')!;
const exact = { exact: true };

function evaluate(_s: State, force: boolean) {
  const r = new FormReader(force);
  const n = (k: string, rules: Parameters<FormReader['number']>[1]) => r.number(field(root, k), rules);
  const price = n('price', { above: 0, label: 'price' });
  const rate = n('rate', { min: 0, max: 100, label: 'interest rate' });
  const months = n('months', { min: 1, max: 600, integer: true, label: 'duration' });
  const down = n('down', { min: 0, optional: true }) ?? 0;
  const fee = n('fee', { min: 0, optional: true }) ?? 0;
  const cash = n('cash', { min: 0, optional: true }) ?? 0;
  const nocost = n('nocost', { min: 0, optional: true }) ?? 0;
  const other = n('other', { min: 0, optional: true }) ?? 0;
  if (price !== undefined) {
    if (down >= price) r.fail('The down payment must be less than the price.');
    if (cash >= price) r.fail('The upfront discount must be less than the price.');
    if (down + nocost >= price) r.fail('The down payment and no-cost discount leave nothing to pay in instalments.');
  }
  if (!r.valid || price === undefined || rate === undefined || months === undefined) {
    return { ok: false as const, nodes: [empty(r.firstProblem ?? 'Enter the price, rate and duration to compare EMI with paying upfront.')] };
  }

  const res = calculateEmi({ price, downPayment: down, annualRate: rate, months, processingFee: fee, otherCharges: other, cashDiscount: cash, noCostDiscount: nocost });
  const nodes: Node[] = [];
  const extra = res.extraVsCash;
  const eff = res.effectiveAnnualRate;

  if (extra > 0.005) {
    nodes.push(
      verdict({
        badge: 'Paying upfront is cheaper',
        value: money(extra, exact),
        unit: 'more with EMI',
        lines: [
          `EMI: ${money(res.emi, exact)} a month for ${months} months`,
          `In total you’d pay ${money(res.emiTotal, exact)} instead of ${money(res.cashTotal, exact)}${eff !== null && eff > 0 ? `, like borrowing at about ${num(eff, 1)}% a year` : ''}.`,
        ],
      }),
    );
  } else {
    nodes.push(
      verdict({
        badge: extra < -0.005 ? 'EMI costs less' : 'EMI costs the same',
        value: money(res.emi, exact),
        unit: `a month for ${months} months`,
        lines: [extra < -0.005 ? `${money(-extra, exact)} less than paying upfront` : 'No extra cost compared with paying upfront', `Total: ${money(res.emiTotal, exact)}`],
      }),
    );
  }

  nodes.push(
    stats([
      { label: 'Monthly EMI', value: money(res.emi, exact), strong: true },
      { label: 'Total with EMI', value: money(res.emiTotal, exact) },
      { label: 'Total interest', value: money(res.interest, exact), note: nocost ? `${money(res.netInterest, exact)} after no-cost discount` : undefined },
      { label: 'Fees and charges', value: money(res.fees, exact) },
      { label: 'Pay upfront', value: money(res.cashTotal, exact) },
      { label: 'Effective yearly rate', value: eff === null ? '—' : `${num(eff, 1)}%`, note: 'incl. fees and lost discounts' },
    ]),
  );

  if (nocost > 0 || rate === 0) {
    const parts: string[] = [];
    if (nocost > 0) parts.push(`the ${money(res.interest, exact)} interest is offset by a ${money(nocost, exact)} discount`);
    if (fee + other > 0) parts.push(`you still pay ${money(fee + other, exact)} in fees and charges`);
    if (cash > 0) parts.push(`you give up the ${money(cash, exact)} discount for paying upfront`);
    if (parts.length) {
      nodes.push(
        notice(
          `About this “no-cost” plan: ${parts.join(', ')}. ${extra > 0.005 ? `So it costs ${money(extra, exact)} more than paying today.` : 'Overall it costs no more than paying today.'}`,
          extra > 0.005 ? 'warn' : 'info',
        ),
      );
    }
  }

  const first = res.schedule.slice(0, 2);
  nodes.push(
    showWhy([
      `Amount on EMI: ${money(price, exact)}${down ? ` − down payment ${money(down, exact)}` : ''}${nocost ? ` − no-cost discount ${money(nocost, exact)}` : ''} = ${money(res.financed, exact)}`,
      rate > 0
        ? `EMI at ${num(rate, 2)}% a year (${num(rate / 12, 3)}% a month) over ${months} months = ${money(res.emi, exact)}`
        : `No interest: ${money(res.financed, exact)} ÷ ${months} = ${money(res.emi, exact)} a month`,
      ...first.map((m) => `Month ${m.month}: ${money(m.interest, exact)} interest + ${money(m.principal, exact)} repaid, ${money(m.balance, exact)} left`),
      `Total with EMI: ${down ? `${money(down, exact)} + ` : ''}${money(res.totalInstalments, exact)}${res.fees ? ` + ${money(res.fees, exact)} fees` : ''} = ${money(res.emiTotal, exact)}`,
      `Pay upfront: ${money(price, exact)}${cash ? ` − ${money(cash, exact)}` : ''} = ${money(res.cashTotal, exact)}`,
    ]),
    h('p', { class: 'mt-3 text-[13px] leading-relaxed text-muted' }, 'Estimates only. Lenders may round instalments, add tax on interest and fees, or count interest differently.'),
  );

  return {
    ok: true as const,
    title: `${money(price)} over ${months} months at ${num(rate, 2)}%`,
    detail: `EMI ${money(res.emi, exact)}, ${extra > 0 ? `${money(extra, exact)} more` : 'no extra'} vs upfront`,
    announce: `Monthly EMI ${money(res.emi, exact)}. ${extra > 0 ? `${money(extra, exact)} more than paying upfront.` : 'No more than paying upfront.'}`,
    nodes,
  };
}

mountTool<State>({
  id: 'emi-vs-cash',
  root,
  read: () => readForm(root),
  write: (s) => writeForm(root, s),
  evaluate,
  defaults: () => ({ price: '', rate: '', months: '12', down: '', fee: '', cash: '', nocost: '', other: '' }),
});
