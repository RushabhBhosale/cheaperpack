import { calculateBogo } from '../../lib/calculations/bogo';
import { money, pct } from '../../lib/ui/currency';
import { $, $$ } from '../../lib/ui/dom';
import { FormReader, field, readForm, writeForm } from '../../lib/ui/fields';
import { empty, notice, showWhy, stats, verdict } from '../../lib/ui/render';
import { mountTool } from '../../lib/ui/tool';

type State = Record<string, string>;
const root = $('[data-tool]')!;

function offerName(buy: number, get: number, disc: number) {
  return disc >= 100 ? `Buy ${buy} get ${get} free` : `Buy ${buy} get ${get} at ${disc}% off`;
}

function evaluate(_s: State, force: boolean) {
  const r = new FormReader(force);
  const n = (k: string, rules: Parameters<FormReader['number']>[1]) => r.number(field(root, k), rules);
  const price = n('price', { above: 0, label: 'price' });
  const buy = n('buy', { min: 1, integer: true, label: 'number to buy' });
  const get = n('get', { min: 1, integer: true, label: 'number you get' });
  const disc = n('disc', { min: 0, max: 100, optional: true }) ?? 100;
  const wanted = n('wanted', { min: 1, integer: true, optional: true });
  const limit = n('limit', { min: 1, integer: true, optional: true });
  const compare = n('compare', { min: 0, max: 100, optional: true });
  if (!r.valid || price === undefined || buy === undefined || get === undefined) {
    return { ok: false as const, nodes: [empty(r.firstProblem ?? 'Enter the price and the offer to see the real cost per item.')] };
  }

  const res = calculateBogo({ price, buy, get, getDiscountPct: disc, wanted, maxSets: limit, comparePct: compare });
  const name = offerName(buy, get, disc);
  const main = res.wanted ?? res.set;
  const nodes: Node[] = [];

  nodes.push(
    verdict({
      badge: name,
      value: money(main.perItem),
      unit: 'per item',
      lines: [
        `${pct(main.savingFraction)} off the normal price of ${money(price)}`,
        `You get ${main.items} items for ${money(main.paid)}, instead of ${money(price * main.items)}.`,
      ],
    }),
  );
  nodes.push(
    stats([
      { label: 'Items you get', value: String(main.items) },
      { label: 'You pay', value: money(main.paid), strong: true },
      { label: 'Price per item', value: money(main.perItem) },
      { label: 'You save', value: money(main.saving), note: pct(main.savingFraction) },
    ]),
  );

  if (res.wanted) {
    const w = res.wanted;
    if (w.limitedBySets) nodes.push(notice(`The offer is limited to ${limit} per order, so ${w.leftover} item${w.leftover === 1 ? ' is' : 's are'} at full price.`, 'info'));
    else if (w.missedFree > 0) nodes.push(notice(`Tip: you’re paying full price for ${w.leftover} extra item${w.leftover === 1 ? '' : 's'}. Add ${w.missedFree} more to get ${w.missedFree === 1 ? 'it' : 'them'} ${disc >= 100 ? 'free' : `at ${disc}% off`}.`, 'info'));
    else if (w.leftover > 0) nodes.push(notice(`${w.leftover} item${w.leftover === 1 ? '' : 's'} outside the offer ${w.leftover === 1 ? 'is' : 'are'} at full price.`, 'info'));
    if (w.sets === 0) nodes.push(notice(`You need at least ${buy + get} items to use this offer.`, 'warn'));
  }

  if (res.compare) {
    const c = res.compare;
    const text =
      c.better === 'same'
        ? `A ${c.pct}% discount costs the same per item (${money(c.perItem)}).`
        : c.better === 'offer'
          ? `The offer beats ${c.pct}% off (${money(c.perItem)} each) by ${money(c.difference)} per item, if you want ${main.items} items.`
          : `${c.pct}% off is better: ${money(c.perItem)} each, ${money(c.difference)} less per item, and you can buy just what you need.`;
    nodes.push(notice(text, c.better === 'discount' ? 'warn' : 'info'));
  }

  const why = [
    `Per offer: ${buy} × ${money(price)}${disc < 100 ? ` + ${get} × ${money(price)} × ${100 - disc}%` : ''} = ${money(res.set.paid)} for ${res.set.items} items`,
    `${money(res.set.paid)} ÷ ${res.set.items} = ${money(res.set.perItem)} per item, ${pct(res.set.savingFraction)} below ${money(price)}`,
  ];
  if (res.wanted) why.push(`For ${res.wanted.items} items: ${res.wanted.sets} offer set${res.wanted.sets === 1 ? '' : 's'} + ${res.wanted.leftover} at full price = ${money(res.wanted.paid)}`);
  why.push('Assumes every item costs the same. If the cheapest item is the free one, use its price.');
  nodes.push(showWhy(why));

  return { ok: true as const, title: `${name} at ${money(price)}`, detail: `${money(main.perItem)} per item`, announce: `${money(main.perItem)} per item, ${pct(main.savingFraction)} off.`, nodes };
}

const tool = mountTool<State>({
  id: 'bogo',
  root,
  read: () => readForm(root),
  write: (s) => writeForm(root, s),
  evaluate,
  defaults: () => ({ price: '', buy: '1', get: '1', disc: '100', wanted: '', limit: '', compare: '' }),
});

for (const b of $$<HTMLButtonElement>('[data-preset-buy]', root)) {
  b.addEventListener('click', () => {
    writeForm(root, { buy: b.dataset.presetBuy!, get: b.dataset.presetGet!, disc: '100' });
    tool.update();
  });
}
