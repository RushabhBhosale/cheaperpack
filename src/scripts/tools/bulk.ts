import { calculateBulk, type Period } from '../../lib/calculations/bulk';
import { UNITS, type UnitId } from '../../lib/calculations/units';
import { TOOL_UNIT_LABELS, isToolUnit } from '../../lib/storage/tool-state';
import { money, num, pct } from '../../lib/ui/currency';
import { $ } from '../../lib/ui/dom';
import { FormReader, field, readForm, writeForm } from '../../lib/ui/fields';
import { empty, notice, showWhy, stats, verdict } from '../../lib/ui/render';
import { mountTool } from '../../lib/ui/tool';

type State = Record<string, string>;
const root = $('[data-tool]')!;
const unit = (v: string | undefined): UnitId => (isToolUnit(v) ? v : 'g');
const period = (v: string | undefined): Period => (v === 'day' || v === 'week' ? v : 'month');

/** e.g. "2 kg", "500 g", "1.67 kg" from an amount in base units. */
function amount(base: number, dim: 'mass' | 'volume' | 'count', like: UnitId): string {
  const u = UNITS[like];
  if (dim === 'count') return `${num(base, 1)} pcs`;
  if (u.us) return `${num(base / u.toBase, 2)} ${TOOL_UNIT_LABELS[like as keyof typeof TOOL_UNIT_LABELS] ?? u.symbol}`;
  const big = dim === 'mass' ? ['kg', 'g'] : ['L', 'ml'];
  return base >= 1000 ? `${num(base / 1000, 2)} ${big[0]}` : `${num(base, 0)} ${big[1]}`;
}

function evaluate(s: State, force: boolean) {
  const r = new FormReader(force);
  const n = (k: string, rules: Parameters<FormReader['number']>[1]) => r.number(field(root, k), rules);
  r.context = 'Regular pack';
  const rp = n('rp', { above: 0, label: 'price' });
  const rq = n('rq', { above: 0, label: 'quantity' });
  r.context = 'Bulk pack';
  const bp = n('bp', { above: 0, label: 'price' });
  const bq = n('bq', { above: 0, label: 'quantity' });
  r.context = null;
  const ua = n('ua', { above: 0, optional: true });
  const life = n('life', { above: 0, optional: true });
  if (!r.valid || rp === undefined || rq === undefined || bp === undefined || bq === undefined) {
    return { ok: false as const, nodes: [empty(r.firstProblem ?? 'Enter both packs to see which is better value.')] };
  }

  const res = calculateBulk({
    regular: { price: rp, quantity: rq, unit: unit(s.ru) },
    bulk: { price: bp, quantity: bq, unit: unit(s.bu) },
    usage: ua !== undefined && life !== undefined ? { amount: ua, unit: unit(s.uu), per: period(s.up) } : undefined,
    shelfLife: ua !== undefined && life !== undefined ? { value: life, per: period(s.lp) } : undefined,
  });
  if ('error' in res) {
    const text =
      res.error === 'mismatch'
        ? 'These packs use different kinds of units (weight, volume or pieces). Use the same kind for both.'
        : 'Your usage is in a different kind of unit from the packs. Use weight with weight, volume with volume.';
    return { ok: false as const, nodes: [notice(text, 'warn')] };
  }

  const dim = res.dimension;
  const ref = dim === 'count' ? { base: 1, label: 'piece' } : dim === 'mass' ? { base: 1000, label: 'kg' } : { base: 1000, label: 'L' };
  if (UNITS[unit(s.bu)].us && dim !== 'count') Object.assign(ref, { base: UNITS[unit(s.bu)].toBase, label: TOOL_UNIT_LABELS[unit(s.bu) as 'oz'] });
  const per = (perBase: number) => money(perBase * ref.base, { extra: 1 });
  const small = dim === 'count' ? 'piece' : dim === 'mass' ? (UNITS[unit(s.bu)].us ? 'ounce' : 'gram') : UNITS[unit(s.bu)].us ? 'fl oz' : 'ml';
  const bulkSize = amount(res.bulkBase, dim, unit(s.bu));
  const regularSize = amount(res.regularBase, dim, unit(s.ru));
  const nodes: Node[] = [];

  if (res.cheaper === 'bulk') {
    nodes.push(
      verdict({
        badge: 'Bulk pack is cheaper',
        title: `The ${bulkSize} pack`,
        value: pct(res.savingFraction),
        unit: `cheaper per ${small}`,
        lines: [
          `Buying the ${bulkSize} pack saves ${pct(res.savingFraction)} per ${small}.`,
          `${bulkSize} in ${regularSize} packs would cost ${money(res.regularCostForBulkAmount)}, so you save ${money(res.bulkSaving)}.`,
        ],
      }),
    );
  } else if (res.cheaper === 'regular') {
    nodes.push(
      verdict({
        badge: 'Regular pack is cheaper',
        tone: 'good',
        title: `The ${regularSize} pack`,
        value: pct(res.savingFraction),
        unit: `cheaper per ${small}`,
        lines: [`The bulk pack costs more for the same amount. ${bulkSize} in regular packs costs ${money(res.regularCostForBulkAmount)}, less than ${money(bp)}.`],
      }),
    );
  } else {
    nodes.push(verdict({ badge: 'Same price per unit', tone: 'plain', value: per(res.bulkPerBase), unit: `per ${ref.label}`, lines: ['Both packs cost the same for the same amount, so buy the size you’ll use.'] }));
  }

  const statItems: Parameters<typeof stats>[0] = [
    { label: 'Regular pack', value: `${per(res.regularPerBase)} / ${ref.label}` },
    { label: 'Bulk pack', value: `${per(res.bulkPerBase)} / ${ref.label}`, strong: res.cheaper === 'bulk' },
  ];
  if (res.breakEvenBase !== undefined) {
    statItems.push({ label: 'Break-even', value: amount(res.breakEvenBase, dim, unit(s.bu)), note: `Use at least ${pct(res.breakEvenFraction!, 0)} of the pack` });
  }
  nodes.push(stats(statItems));

  if (res.usage) {
    const u = res.usage;
    const used = amount(u.usedBeforeExpiryBase, dim, unit(s.bu));
    if (u.wastedBase > 0.0001 * res.bulkBase) {
      const wasted = amount(u.wastedBase, dim, unit(s.bu));
      nodes.push(
        notice(
          u.worthIt
            ? `You’d use about ${used} before it expires and waste ${wasted} (${money(u.wastedValue)}). It still works out cheaper than regular packs.`
            : `You’d only use about ${used} before it expires, so ${wasted} (${money(u.wastedValue)}) would go to waste. That’s below the break-even amount: buy regular packs instead.`,
          u.worthIt ? 'info' : 'warn',
        ),
      );
    } else if (res.cheaper === 'bulk') {
      nodes.push(notice(`At your rate you’ll finish it in about ${num(u.daysToFinish, 0)} days, well before it expires. No waste expected.`, 'info'));
    }
  }

  nodes.push(
    showWhy([
      `Regular: ${money(rp)} ÷ ${regularSize} = ${per(res.regularPerBase)} per ${ref.label}`,
      `Bulk: ${money(bp)} ÷ ${bulkSize} = ${per(res.bulkPerBase)} per ${ref.label}`,
      `Difference: ${per(Math.abs(res.regularPerBase - res.bulkPerBase))} per ${ref.label}`,
      ...(res.breakEvenBase !== undefined ? [`Break-even: ${money(bp)} ÷ ${per(res.regularPerBase)} per ${ref.label} = ${amount(res.breakEvenBase, dim, unit(s.bu))}`] : []),
    ]),
  );

  const title = `${regularSize} vs ${bulkSize}`;
  const detail = res.cheaper === 'bulk' ? `Bulk ${pct(res.savingFraction)} cheaper` : res.cheaper === 'regular' ? 'Regular pack cheaper' : 'Same price per unit';
  return { ok: true as const, title, detail, announce: `${detail}.`, nodes };
}

mountTool<State>({
  id: 'bulk-buying',
  root,
  read: () => readForm(root),
  write: (s) => writeForm(root, s),
  evaluate,
  defaults: () => ({ rp: '', rq: '', ru: 'g', bp: '', bq: '', bu: 'kg', ua: '', uu: 'g', up: 'week', life: '', lp: 'month' }),
});
