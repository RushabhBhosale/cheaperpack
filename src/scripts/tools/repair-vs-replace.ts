import { compareCostPerUse, type UseItem } from '../../lib/calculations/cost-per-use';
import { money, num, pct } from '../../lib/ui/currency';
import { $, letter, listNames } from '../../lib/ui/dom';
import { FormReader, field } from '../../lib/ui/fields';
import { bars, empty, showWhy, verdict } from '../../lib/ui/render';
import { RowList } from '../../lib/ui/rows';
import { mountTool } from '../../lib/ui/tool';

type Row = Record<string, string>;
interface State {
  rows: Row[];
}
const root = $('[data-tool]')!;
const rows = new RowList({
  list: $('[data-rows]', root)!,
  template: $<HTMLTemplateElement>('[data-row-template]', root)!,
  min: 2,
  max: 4,
  addButton: $<HTMLButtonElement>('[data-add]', root),
  noun: 'Option',
  onChange: () => tool.update(),
});
rows.relabel();

function evaluate(state: State, force: boolean) {
  const r = new FormReader(force);
  const items: UseItem[] = [];
  const names: string[] = [];
  rows.rows().forEach((el, i) => {
    const name = state.rows[i]?.name?.trim() || `Option ${letter(i)}`;
    r.context = name;
    const price = r.number(field(el, 'price'), { min: 0, label: 'cost' });
    const months = r.number(field(el, 'months'), { above: 0, label: 'months of use' });
    const resale = r.number(field(el, 'resale'), { min: 0, optional: true }) ?? 0;
    if (price !== undefined && resale > price) r.fail('the resale value is more than the cost, so there is nothing to spread over the months.');
    if (price !== undefined && months !== undefined) {
      items.push({ name, price, uses: months, maintenance: 0, resale });
      names.push(name);
    }
  });
  if (!r.valid || items.length < 2) return { ok: false as const, nodes: [empty(r.firstProblem ?? 'Enter a cost and the months of use for at least two options.')] };

  const c = compareCostPerUse(items);
  const best = c.best.map((i) => names[i]!);
  const bestR = c.results[c.best[0]!]!;
  const nodes: Node[] = [];

  if (c.runnerUp === undefined) {
    nodes.push(verdict({ badge: 'Same cost per month', tone: 'plain', title: listNames(best), value: money(bestR.perUse), unit: 'a month' }));
  } else {
    nodes.push(
      verdict({
        badge: best.length > 1 ? 'Joint lowest cost per month' : 'Lowest cost per month',
        title: listNames(best),
        value: money(bestR.perUse),
        unit: 'a month',
        lines: [`${pct(c.cheaperBy)} cheaper per month than ${names[c.runnerUp]}`, `Net cost: ${money(bestR.total)} over ${num(items[c.best[0]!]!.uses, 0)} months`],
      }),
    );
  }

  const max = Math.max(...c.results.map((x) => x.perUse));
  nodes.push(bars(c.results.map((x, i) => ({ label: names[i]!, value: `${money(x.perUse)} / month`, fraction: x.perUse / max, highlight: c.best.includes(i) }))));
  nodes.push(
    showWhy(
      items.map((it, i) => {
        const res = c.results[i]!;
        const resale = it.resale ? ` − ${money(it.resale)} resale` : '';
        return `${names[i]}: (${money(it.price)}${resale}) ÷ ${num(it.uses, 0)} months = ${money(res.perUse)} per month`;
      }),
    ),
  );

  return {
    ok: true as const,
    title: names.join(' vs '),
    detail: `${listNames(best)}: ${money(bestR.perUse)} per month`,
    announce: `${listNames(best)} costs ${money(bestR.perUse)} per month.`,
    nodes,
  };
}

const tool = mountTool<State>({
  id: 'repair-vs-replace',
  root,
  read: () => ({ rows: rows.read() }),
  write: (s) => rows.write(Array.isArray(s.rows) ? s.rows : []),
  evaluate,
  defaults: () => ({ rows: [{}, {}] }),
});
