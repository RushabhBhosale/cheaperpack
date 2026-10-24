import { compareDeals, type DealInput, type Discount } from '../../lib/calculations/deals';
import { $, h, letter, listNames } from '../../lib/ui/dom';
import { FormReader, field, readForm, writeForm } from '../../lib/ui/fields';
import { money, pct } from '../../lib/ui/currency';
import { empty, showWhy, stats, verdict } from '../../lib/ui/render';
import { RowList } from '../../lib/ui/rows';
import { mountTool } from '../../lib/ui/tool';

type Row = Record<string, string>;
interface State {
  stacking: string;
  rows: Row[];
}

const root = $('[data-tool]')!;
const rows = new RowList({
  list: $('[data-rows]', root)!,
  template: $<HTMLTemplateElement>('[data-row-template]', root)!,
  min: 2,
  max: 4,
  addButton: $<HTMLButtonElement>('[data-add]', root),
  noun: 'Deal',
  onChange: () => tool.update(),
});
rows.relabel();

const label = (r: Row, i: number) => r.name?.trim() || `Deal ${letter(i)}`;

function evaluate(state: State, force: boolean) {
  const reader = new FormReader(force);
  const elRows = rows.rows();
  const inputs: DealInput[] = [];
  elRows.forEach((el, i) => {
    reader.context = label(state.rows[i] ?? {}, i);
    const n = (k: string, rules: Parameters<FormReader['number']>[1]) => reader.number(field(el, k), rules);
    const price = n('price', { above: 0, label: 'price' });
    const qty = n('qty', { min: 1, integer: true, optional: true }) ?? 1;
    const discounts: Discount[] = [];
    const disc = (k: string, capK?: string) => {
      const kind = state.rows[i]?.[`${k}k`] === 'fixed' ? 'fixed' : 'percent';
      const value = n(k, { min: 0, optional: true, max: kind === 'percent' ? 100 : undefined });
      const cap = capK ? n(capK, { min: 0, optional: true }) : undefined;
      if (value) discounts.push({ kind, value, cap, label: kind === 'percent' ? `${value}% ${k === 'd2' ? 'coupon' : 'off'}` : k === 'd2' ? 'Coupon' : 'Discount' });
    };
    disc('d1', 'd1cap');
    disc('d2', 'd2cap');
    disc('d3');
    const delivery = n('delivery', { min: 0, optional: true }) ?? 0;
    const cbKind = state.rows[i]?.cbk === 'fixed' ? 'fixed' : 'percent';
    const cb = n('cb', { min: 0, optional: true, max: cbKind === 'percent' ? 100 : undefined });
    const cbcap = n('cbcap', { min: 0, optional: true });
    const buy = n('buy', { min: 1, integer: true, optional: true });
    const get = n('get', { min: 1, integer: true, optional: true });
    if ((buy === undefined) !== (get === undefined)) reader.fail('enter both “Buy” and “Get free”, or neither.');
    if (price !== undefined) {
      inputs.push({
        name: label(state.rows[i] ?? {}, i),
        price,
        quantity: qty,
        discounts,
        stacking: state.stacking === 'original' ? 'original' : 'sequential',
        delivery,
        cashback: cb ? { kind: cbKind, value: cb, cap: cbcap } : undefined,
        buyGet: buy && get ? { buy, get } : undefined,
      });
    }
  });

  if (!reader.valid || inputs.length < 2) {
    return { ok: false as const, nodes: [empty(reader.firstProblem ? `${reader.firstProblem}` : 'Enter a price for each deal to see which costs least.')] };
  }

  const c = compareDeals(inputs);
  const names = inputs.map((d) => d.name!);
  const best = c.best.map((i) => names[i]!);
  const bestR = c.results[c.best[0]!]!;
  const costOf = (i: number) => (c.perItem ? c.results[i]!.effectivePerItem : c.results[i]!.effective);
  const unit = c.perItem ? 'per item' : undefined;
  const nodes: Node[] = [];

  if (c.runnerUp === undefined) {
    nodes.push(verdict({ badge: 'Same cost', tone: 'plain', title: listNames(best), value: money(costOf(c.best[0]!), { exact: true }), unit, lines: ['These deals cost exactly the same.'] }));
  } else {
    const lines = [`${money(c.difference, { exact: true })} ${c.perItem ? 'per item ' : ''}cheaper than ${names[c.runnerUp]} (${pct(c.differenceFraction)} less)`];
    if (bestR.cashback > 0) lines.push(`You pay ${money(bestR.checkout, { exact: true })} at checkout and get ${money(bestR.cashback, { exact: true })} back later.`);
    else if (bestR.itemsReceived > bestR.itemsPaid) lines.push(`You get ${bestR.itemsReceived} items for ${money(bestR.checkout, { exact: true })}.`);
    nodes.push(verdict({ badge: best.length > 1 ? 'Joint lowest cost' : 'Lowest cost', title: listNames(best), value: money(costOf(c.best[0]!), { exact: true }), unit, lines }));
  }

  // Each deal at a glance.
  nodes.push(
    h(
      'ul',
      { class: 'mt-5 grid gap-3 border-t border-line pt-4' },
      ...c.results.map((r, i) =>
        h(
          'li',
          { class: 'text-[14px]' },
          h(
            'div',
            { class: 'flex items-baseline justify-between gap-3' },
            h('span', { class: 'min-w-0 truncate text-[15px] font-semibold' }, `${letter(i)} · ${names[i]}`),
            h('span', { class: `stat shrink-0 text-[15px] font-semibold ${c.best.includes(i) ? 'text-good' : ''}` }, money(r.effective, { exact: true })),
          ),
          h(
            'p',
            { class: 'mt-0.5 text-muted' },
            `Pay ${money(r.checkout, { exact: true })}`,
            r.cashback ? ` · ${money(r.cashback, { exact: true })} cashback later` : '',
            r.itemsReceived !== 1 ? ` · ${r.itemsReceived} items (${money(r.effectivePerItem)} each)` : '',
          ),
        ),
      ),
    ),
  );

  const why: (string | HTMLElement)[] = [];
  c.results.forEach((r, i) => {
    const parts = [`${letter(i)} · ${names[i]}: ${money(inputs[i]!.price, { exact: true })}${r.itemsPaid !== 1 ? ` × ${r.itemsPaid} = ${money(r.subtotal, { exact: true })}` : ''}`];
    for (const s of r.discountSteps) parts.push(`− ${s.label} ${money(s.amount, { exact: true })}`);
    if (r.delivery) parts.push(`+ delivery ${money(r.delivery, { exact: true })}`);
    parts.push(`= ${money(r.checkout, { exact: true })} at checkout`);
    if (r.cashback) parts.push(`− cashback ${money(r.cashback, { exact: true })} = ${money(r.effective, { exact: true })} effective`);
    if (r.itemsReceived !== r.itemsPaid) parts.push(`for ${r.itemsReceived} items = ${money(r.effectivePerItem)} each`);
    why.push(parts.join(' '));
  });
  const intro =
    state.stacking === 'original'
      ? 'Each discount is worked out on the original price.'
      : 'Discounts apply one after another, each on the price left after the previous one.';
  const notes: string[] = [];
  if (inputs.some((d) => d.cashback?.kind === 'percent')) notes.push('Percentage cashback is worked out on the order after discounts, not on delivery.');
  if (c.perItem) notes.push('The deals give different numbers of items, so they are compared per item.');
  nodes.push(showWhy([...why, ...notes], intro));

  const title = names.join(' vs ');
  return {
    ok: true as const,
    title,
    detail: c.runnerUp === undefined ? 'Same cost' : `Best: ${listNames(best)}, ${money(costOf(c.best[0]!), { exact: true })}`,
    announce: c.runnerUp === undefined ? 'The deals cost the same.' : `${listNames(best)} costs least: ${money(costOf(c.best[0]!), { exact: true })}${c.perItem ? ' per item' : ''}.`,
    nodes,
  };
}

const tool = mountTool<State>({
  id: 'deal-calculator',
  root,
  read: () => ({ stacking: readForm(root).stacking ?? 'sequential', rows: rows.read() }),
  write: (s) => {
    writeForm(root, { stacking: s.stacking ?? 'sequential' });
    rows.write(Array.isArray(s.rows) ? s.rows : []);
    for (const d of root.querySelectorAll<HTMLDetailsElement>('[data-row] details')) {
      const r = readForm(d.closest('[data-row]')!);
      d.open = !!(r.d2 || r.d3 || r.cb || r.buy || r.d1cap);
    }
  },
  evaluate,
  defaults: () => ({ stacking: 'sequential', rows: [{ qty: '1' }, { qty: '1' }] }),
});
