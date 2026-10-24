import { electricityTotals, type Appliance } from '../../lib/calculations/electricity';
import { money, num, pct } from '../../lib/ui/currency';
import { $, $$, letter } from '../../lib/ui/dom';
import { FormReader, field, readForm, writeForm } from '../../lib/ui/fields';
import { bars, empty, notice, showWhy, stats, verdict } from '../../lib/ui/render';
import { RowList } from '../../lib/ui/rows';
import { mountTool } from '../../lib/ui/tool';

type Row = Record<string, string>;
interface State {
  rate: string;
  rows: Row[];
}
const root = $('[data-tool]')!;
const rows = new RowList({
  list: $('[data-rows]', root)!,
  template: $<HTMLTemplateElement>('[data-row-template]', root)!,
  min: 1,
  max: 15,
  addButton: $<HTMLButtonElement>('[data-add]', root),
  noun: 'Appliance',
  onChange: () => tool.update(),
});
rows.relabel();

function evaluate(state: State, force: boolean) {
  const r = new FormReader(force);
  const rate = r.number(field(root, 'rate'), { above: 0, label: 'electricity rate' });
  const list: Appliance[] = [];
  const names: string[] = [];
  rows.rows().forEach((el, i) => {
    const name = state.rows[i]?.name?.trim() || `Appliance ${letter(i)}`;
    r.context = name;
    const watts = r.number(field(el, 'watts'), { min: 0, max: 100000, label: 'power' });
    const hours = r.number(field(el, 'hours'), { min: 0, max: 24, label: 'hours a day' });
    const days = r.number(field(el, 'days'), { min: 0, max: 31, label: 'days a month' });
    const standby = r.number(field(el, 'standby'), { min: 0, max: 10000, optional: true }) ?? 0;
    const qty = r.number(field(el, 'qty'), { min: 1, max: 1000, integer: true, optional: true }) ?? 1;
    if (watts !== undefined && hours !== undefined && days !== undefined) {
      list.push({ name, watts, hoursPerDay: hours, daysPerMonth: days, standbyWatts: standby, quantity: qty });
      names.push(qty > 1 ? `${name} × ${qty}` : name);
    }
  });
  r.context = null;
  if (!r.valid || rate === undefined || list.length === 0) {
    return { ok: false as const, nodes: [empty(r.firstProblem ?? 'Enter your rate and an appliance’s power and hours of use.')] };
  }

  const t = electricityTotals(list, rate);
  const nodes: Node[] = [
    verdict({
      badge: 'Estimated cost',
      tone: 'plain',
      value: money(t.costPerMonth),
      unit: 'a month',
      lines: [`${money(t.costPerYear)} a year`],
    }),
    stats([
      { label: 'Per day', value: `${num(t.kwhPerDay, 2)} kWh`, note: money(t.costPerMonth / 30) },
      { label: 'Per month', value: `${num(t.kwhPerMonth, 1)} kWh`, strong: true },
      { label: 'Per year', value: `${num(t.kwhPerYear, 0)} kWh` },
      { label: 'Rate', value: `${money(rate, { exact: true })} / kWh` },
    ]),
  ];
  if (list.length > 1) {
    const order = t.rows.map((_, i) => i).sort((a, b) => t.rows[b]!.costPerMonth - t.rows[a]!.costPerMonth);
    nodes.push(
      bars(
        order.map((i) => ({
          label: names[i]!,
          value: `${money(t.rows[i]!.costPerMonth)} · ${pct(t.shares[i]!, 0)}`,
          fraction: t.shares[i]!,
          highlight: i === order[0],
        })),
      ),
    );
  }
  const standbyKwh = t.rows.reduce((s, x) => s + x.standbyKwhPerMonth, 0);
  if (standbyKwh > 0) nodes.push(notice(`Standby power adds ${num(standbyKwh, 1)} kWh (${money(standbyKwh * rate)}) a month. Switching off at the plug saves that.`, 'info'));

  nodes.push(
    showWhy(
      list.map((a, i) => {
        const row = t.rows[i]!;
        const active = `${num(a.watts, 0)} W × ${num(a.hoursPerDay, 2)} h × ${num(a.daysPerMonth, 0)} days${a.quantity > 1 ? ` × ${a.quantity}` : ''} ÷ 1,000`;
        return `${names[i]}: ${active}${a.standbyWatts ? ' + standby' : ''} = ${num(row.kwhPerMonth, 2)} kWh × ${money(rate, { exact: true })} = ${money(row.costPerMonth)} a month`;
      }),
      'Real bills may add fixed charges and taxes, and slab tariffs change the rate as use rises. A month is counted as 30 days for standby time.',
    ),
  );

  return {
    ok: true as const,
    title: list.length === 1 ? names[0]! : `${list.length} appliances`,
    detail: `${money(t.costPerMonth)} a month`,
    announce: `About ${money(t.costPerMonth)} a month, ${money(t.costPerYear)} a year.`,
    nodes,
  };
}

const tool = mountTool<State>({
  id: 'electricity',
  root,
  read: () => ({ rate: readForm(root).rate ?? '', rows: rows.read() }),
  write: (s) => {
    writeForm(root, { rate: s.rate ?? '' });
    rows.write(Array.isArray(s.rows) ? s.rows : []);
  },
  evaluate,
  defaults: () => ({ rate: '', rows: [{ days: '30', qty: '1' }] }),
});

for (const b of $$<HTMLButtonElement>('[data-preset]', root)) {
  b.addEventListener('click', () => {
    const p = JSON.parse(b.dataset.preset!) as { name: string; watts: number; hours: number; standby: number };
    // Fill an empty row first, otherwise add one.
    const blank = rows.rows().find((row) => !field(row, 'watts')?.value && !field(row, 'name')?.value);
    const values = { name: p.name, watts: String(p.watts), hours: String(p.hours), days: '30', standby: p.standby ? String(p.standby) : '', qty: '1' };
    const row = blank ?? rows.add(values);
    if (blank) writeForm(blank, values);
    if (!row) return;
    tool.update();
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    field<HTMLInputElement>(row, 'hours')?.focus({ preventScroll: true });
  });
}
