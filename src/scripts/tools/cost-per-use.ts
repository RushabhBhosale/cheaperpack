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
  min: 1,
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
    const price = r.number(field(el, 'price'), { min: 0, label: 'price' });
    const uses = r.number(field(el, 'uses'), { above: 0, label: 'number of uses' });
    const upkeep = r.number(field(el, 'upkeep'), { min: 0, optional: true }) ?? 0;
    const resale = r.number(field(el, 'resale'), { min: 0, optional: true }) ?? 0;
    if (price !== undefined && resale > price + upkeep) r.fail('the resale value is more than it costs to own.');
    if (price !== undefined && uses !== undefined) {
      items.push({ name, price, uses, maintenance: upkeep, resale });
      names.push(name);
    }
  });
  if (!r.valid || items.length === 0) return { ok: false as const, nodes: [empty(r.firstProblem ?? 'Enter a price and how many times you’ll use it.')] };

  const c = compareCostPerUse(items);
  const nodes: Node[] = [];
  const best = c.best.map((i) => names[i]!);
  const bestR = c.results[c.best[0]!]!;

  if (items.length === 1) {
    nodes.push(verdict({ badge: 'Cost per use', tone: 'plain', title: names[0], value: money(bestR.perUse), unit: 'each time', lines: [`Total cost to own: ${money(bestR.total)}`] }));
  } else if (c.runnerUp === undefined) {
    nodes.push(verdict({ badge: 'Same cost per use', tone: 'plain', title: listNames(best), value: money(bestR.perUse), unit: 'each time' }));
  } else {
    nodes.push(
      verdict({
        badge: best.length > 1 ? 'Joint lowest cost per use' : 'Lowest cost per use',
        title: listNames(best),
        value: money(bestR.perUse),
        unit: 'each time',
        lines: [`${pct(c.cheaperBy)} cheaper per use than ${names[c.runnerUp]}`, `Total cost to own: ${money(bestR.total)} over ${num(items[c.best[0]!]!.uses, 0)} uses`],
      }),
    );
  }

  if (items.length > 1) {
    const max = Math.max(...c.results.map((x) => x.perUse));
    nodes.push(bars(c.results.map((x, i) => ({ label: names[i]!, value: `${money(x.perUse)} / use`, fraction: x.perUse / max, highlight: c.best.includes(i) }))));
  }

  nodes.push(
    showWhy(
      items.map((it, i) => {
        const res = c.results[i]!;
        const extras = `${it.maintenance ? ` + ${money(it.maintenance)} upkeep` : ''}${it.resale ? ` − ${money(it.resale)} resale` : ''}`;
        return `${names[i]}: (${money(it.price)}${extras}) ÷ ${num(it.uses, 0)} uses = ${money(res.perUse)} per use`;
      }),
    ),
  );

  return {
    ok: true as const,
    title: names.join(' vs '),
    detail: `${listNames(best)}: ${money(bestR.perUse)} per use`,
    announce: `${listNames(best)} costs ${money(bestR.perUse)} per use.`,
    nodes,
  };
}

const tool = mountTool<State>({
  id: 'cost-per-use',
  root,
  read: () => ({ rows: rows.read() }),
  write: (s) => {
    rows.write(Array.isArray(s.rows) ? s.rows : []);
    for (const d of root.querySelectorAll<HTMLDetailsElement>('[data-row] details')) {
      d.open = !!(field(d, 'upkeep')?.value || field(d, 'resale')?.value);
    }
  },
  evaluate,
  defaults: () => ({ rows: [{}, {}] }),
});
