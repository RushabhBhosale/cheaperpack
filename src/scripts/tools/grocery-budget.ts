import { lineTotal, listToCsv, listToText, parseBudgetEntry, summariseBudget, type BudgetItem } from '../../lib/calculations/budget';
import { newId, readJSON, writeJSON } from '../../lib/storage/local';
import { initCurrency, locale, localeDecimal, money, onCurrency, pct } from '../../lib/ui/currency';
import { $, debounce, h } from '../../lib/ui/dom';
import { FormReader, field, setError } from '../../lib/ui/fields';
import { checkNumber } from '../../lib/calculations/validate';
import { empty, verdict } from '../../lib/ui/render';
import { decodeState, downloadText, encodeState, shareLink, toast } from '../../lib/ui/share';

interface ShoppingList {
  id: string;
  name: string;
  budget: string;
  items: BudgetItem[];
  savedAt: number;
}

const root = $('[data-planner]')!;
const itemsEl = $('[data-items]')!;
const itemsEmpty = $('[data-items-empty]')!;
const summary = $('[data-summary]')!;
const addForm = $<HTMLFormElement>('[data-add-form]')!;
const entry = field(addForm, 'entry')!;
const nameInput = field(root, 'listname')!;
const budgetInput = field(root, 'budget')!;
const live = $('[data-live]')!;

const isItem = (i: unknown): i is BudgetItem =>
  !!i && typeof (i as BudgetItem).name === 'string' && typeof (i as BudgetItem).qty === 'number' && typeof (i as BudgetItem).price === 'number';

function validList(l: unknown): l is ShoppingList {
  return !!l && typeof (l as ShoppingList).id === 'string' && Array.isArray((l as ShoppingList).items);
}

let current: ShoppingList = readJSON<unknown>('grocery:current', null) as ShoppingList;
if (!validList(current)) current = { id: newId(), name: 'Shopping list', budget: '', items: [], savedAt: Date.now() };
current.items = current.items.filter(isItem);

const lists = (): ShoppingList[] => {
  const raw = readJSON<unknown>('grocery:lists', []);
  return Array.isArray(raw) ? raw.filter(validList) : [];
};
const persist = debounce(() => writeJSON('grocery:current', current), 300);

function budget(): number | undefined {
  const r = checkNumber(current.budget, { min: 0, optional: true }, localeDecimal);
  return r.ok ? r.value : undefined;
}

function renderItems() {
  itemsEmpty.hidden = current.items.length > 0;
  itemsEl.hidden = current.items.length === 0;
  itemsEl.replaceChildren(
    ...current.items.map((it) => {
      const check = h('input', { type: 'checkbox', class: 'size-5 shrink-0 accent-accent', 'aria-label': `Bought ${it.name}` }) as HTMLInputElement;
      check.checked = it.purchased;
      check.addEventListener('change', () => update(it.id, { purchased: check.checked }));
      const name = h('input', { type: 'text', value: it.name, maxlength: 60, 'aria-label': 'Item name', class: `min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 text-[15px] outline-none focus:bg-subtle ${it.purchased ? 'text-muted line-through' : ''}` }) as HTMLInputElement;
      name.addEventListener('change', () => update(it.id, { name: name.value.trim() || it.name }, false));
      const numInput = (value: number, label: string, cls: string, onValue: (v: number) => void) => {
        const el = h('input', { type: 'text', inputmode: 'decimal', value: String(value), 'aria-label': label, class: `rounded-lg border border-line bg-white px-2 py-2 text-right text-[15px] tabular-nums outline-none focus:border-accent ${cls}` }) as HTMLInputElement;
        el.addEventListener('input', () => {
          const r = checkNumber(el.value, { min: 0 }, localeDecimal);
          el.toggleAttribute('aria-invalid', !r.ok);
          el.classList.toggle('!border-bad', !r.ok);
          if (r.ok && r.value !== undefined) onValue(r.value);
        });
        return el;
      };
      const qty = numInput(it.qty, `Quantity of ${it.name}`, 'w-14', (v) => update(it.id, { qty: v }, false));
      const price = numInput(it.price, `Price of ${it.name}`, 'w-20', (v) => update(it.id, { price: v }, false));
      const total = h('span', { class: 'w-20 shrink-0 text-right text-[15px] font-semibold tabular-nums', 'data-line-total': it.id }, money(lineTotal(it)));
      const del = h('button', { type: 'button', class: 'icon-btn !size-9', 'aria-label': `Remove ${it.name}` }, '×');
      del.addEventListener('click', () => {
        current.items = current.items.filter((x) => x.id !== it.id);
        changed();
        toast(`${it.name} removed`);
      });
      return h(
        'li',
        { class: 'flex items-center gap-2 px-3 py-2' },
        check,
        name,
        h('span', { class: 'flex items-center gap-1 text-muted' }, qty, h('span', { 'aria-hidden': 'true', class: 'text-[13px]' }, '×'), price),
        h('span', { class: 'hidden sm:inline' }, total),
        del,
      );
    }),
  );
}

function renderSummary() {
  const b = budget();
  const s = summariseBudget(b, current.items);
  const nodes: Node[] = [];
  if (current.items.length === 0 && b === undefined) {
    summary.replaceChildren(empty('Set a budget and add items to see your total and what’s left.'));
    return;
  }
  if (b !== undefined) {
    nodes.push(
      verdict({
        badge: s.over ? 'Over budget' : 'Left to spend',
        tone: s.over ? 'plain' : 'good',
        value: h('span', { class: s.over ? 'text-bad' : '' }, money(Math.abs(s.left))),
        unit: s.over ? 'over' : 'left',
        lines: [],
      }),
    );
    nodes.push(
      h(
        'div',
        { class: 'mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-line', role: 'progressbar', 'aria-label': 'Budget used', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(Math.min(1, s.usedFraction) * 100) },
        h('div', { class: `ui-bar h-full rounded-full ${s.over ? 'bg-bad' : 'bg-good-fill'}`, style: `width:${Math.min(100, s.usedFraction * 100)}%` }),
      ),
    );
  } else {
    nodes.push(verdict({ badge: 'Total', tone: 'plain', value: money(s.total), lines: [] }));
  }
  nodes.push(
    h(
      'dl',
      { class: 'mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]' },
      ...(b !== undefined ? [h('dt', { class: 'text-muted' }, 'Budget'), h('dd', { class: 'stat text-right font-semibold' }, money(b))] : []),
      h('dt', { class: 'text-muted' }, 'List total'),
      h('dd', { class: 'stat text-right font-semibold' }, money(s.total)),
      h('dt', { class: 'text-muted' }, 'Bought so far'),
      h('dd', { class: 'stat text-right' }, `${money(s.purchasedTotal)} (${s.purchasedCount}/${s.count})`),
      h('dt', { class: 'text-muted' }, 'Still to buy'),
      h('dd', { class: 'stat text-right' }, money(s.remainingToBuy)),
      ...(b !== undefined ? [h('dt', { class: 'text-muted' }, 'Budget used'), h('dd', { class: 'stat text-right' }, pct(s.usedFraction, 0))] : []),
    ),
  );
  summary.replaceChildren(...nodes);
  const mini = $('[data-mini]')!;
  mini.hidden = current.items.length === 0;
  mini.className = `-mt-1 rounded-xl px-3.5 py-2.5 text-[15px] font-medium lg:hidden ${s.over ? 'bg-bad-soft text-bad' : 'bg-subtle'}`;
  mini.textContent = `Total ${money(s.total)}${b !== undefined ? (s.over ? ` · ${money(-s.left)} over budget` : ` · ${money(s.left)} left`) : ''}`;
  live.textContent = b !== undefined ? (s.over ? `${money(-s.left)} over budget.` : `${money(s.left)} left.`) : `Total ${money(s.total)}.`;
}

function renderLists() {
  const all = lists().filter((l) => l.items.length);
  $('[data-lists-wrap]')!.hidden = all.length === 0;
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  $('[data-lists]')!.replaceChildren(
    ...all.map((l) => {
      const total = summariseBudget(undefined, l.items).total;
      const open = h('button', { type: 'button', class: 'btn btn-ghost !min-h-9 !px-2 !text-[13px]' }, 'Open');
      open.addEventListener('click', () => switchTo({ ...l, items: l.items.map((i) => ({ ...i })) }));
      const again = h('button', { type: 'button', class: 'btn btn-ghost !min-h-9 !px-2 !text-[13px]' }, 'Use again');
      again.addEventListener('click', () =>
        switchTo({ id: newId(), name: l.name, budget: l.budget, items: l.items.map((i) => ({ ...i, id: newId(), purchased: false })), savedAt: Date.now() }),
      );
      const del = h('button', { type: 'button', class: 'icon-btn !size-9', 'aria-label': `Delete list ${l.name}` }, '×');
      del.addEventListener('click', () => {
        writeJSON('grocery:lists', lists().filter((x) => x.id !== l.id));
        renderLists();
        toast('List deleted');
      });
      return h(
        'li',
        { class: 'flex items-center gap-2 px-4 py-2.5' },
        h('div', { class: 'min-w-0 flex-1' }, h('p', { class: 'truncate text-[15px] font-medium' }, l.name), h('p', { class: 'text-[13px] text-muted' }, `${l.items.length} items · ${money(total)} · ${fmt.format(l.savedAt)}`)),
        open,
        again,
        del,
      );
    }),
  );
}

function saveCurrent(silent = false) {
  if (!current.items.length) {
    if (!silent) toast('Add some items first');
    return;
  }
  current.savedAt = Date.now();
  writeJSON('grocery:lists', [{ ...current }, ...lists().filter((l) => l.id !== current.id)].slice(0, 20));
  renderLists();
  if (!silent) toast('List saved on this device');
}

function switchTo(list: ShoppingList) {
  if (current.items.length) saveCurrent(true);
  current = list;
  nameInput.value = current.name;
  budgetInput.value = current.budget;
  changed();
  toast(`Opened “${current.name}”`);
  root.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function update(id: string, patch: Partial<BudgetItem>, rerenderItems = true) {
  current.items = current.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  if (rerenderItems) renderItems();
  else {
    const it = current.items.find((i) => i.id === id);
    const cell = itemsEl.querySelector(`[data-line-total="${id}"]`);
    if (it && cell) cell.textContent = money(lineTotal(it));
  }
  renderSummary();
  persist();
}

function changed() {
  renderItems();
  renderSummary();
  persist();
}

addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = entry.value.trim();
  if (!text) {
    setError(entry, 'Type an item, like “Milk 2 x 32”.');
    entry.focus();
    return;
  }
  const p = parseBudgetEntry(text, localeDecimal);
  current.items.push({ id: newId(), name: p.name.slice(0, 60), qty: p.qty, price: p.price ?? 0, purchased: false });
  setError(entry, null);
  entry.value = '';
  changed();
  if (p.price === undefined) {
    toast(`Added ${p.name}. Enter its price in the list.`);
    itemsEl.querySelector<HTMLInputElement>('li:last-child input[aria-label^="Price"]')?.focus();
  } else {
    entry.focus();
  }
});

nameInput.addEventListener('input', () => {
  current.name = nameInput.value.trim() || 'Shopping list';
  persist();
});
budgetInput.addEventListener('input', () => {
  current.budget = budgetInput.value;
  const r = new FormReader(false);
  r.number(budgetInput, { min: 0, optional: true });
  renderSummary();
  persist();
});

$('[data-save]')!.addEventListener('click', () => saveCurrent());
$('[data-new]')!.addEventListener('click', () => {
  if (current.items.length) saveCurrent(true);
  current = { id: newId(), name: 'Shopping list', budget: current.budget, items: [], savedAt: Date.now() };
  nameInput.value = current.name;
  changed();
  toast(current.items.length ? 'New list' : 'Started a new list');
  entry.focus();
});
const money0 = (v: number) => money(v);
$('[data-copy]')!.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(listToText(current.name, current.items, money0, budget()));
    toast('List copied');
  } catch {
    toast('Couldn’t copy. Try “Download CSV” instead.');
  }
});
$('[data-csv]')!.addEventListener('click', () => {
  downloadText(`${current.name.replace(/[^\w\- ]+/g, '').trim() || 'shopping-list'}.csv`, listToCsv(current.items), 'text/csv');
});
$('[data-share-list]')!.addEventListener('click', () => {
  if (!current.items.length) return toast('Add some items first');
  const state = { n: current.name, b: current.budget, i: current.items.map((i) => [i.name, i.qty, i.price]) };
  void shareLink(`${location.origin}${location.pathname}#${encodeState(state)}`, current.name, listToText(current.name, current.items, money0, budget()));
});

// A shared list opens as a new list; the previous one is kept in saved lists.
const shared = decodeState<{ n?: string; b?: string; i?: [string, number, number][] }>(location.hash);
if (shared && Array.isArray(shared.i)) {
  const items = shared.i
    .filter((r) => Array.isArray(r) && typeof r[0] === 'string')
    .slice(0, 200)
    .map(([name, qty, price]) => ({ id: newId(), name: String(name).slice(0, 60), qty: Number(qty) || 1, price: Number(price) || 0, purchased: false }));
  if (current.items.length) saveCurrent(true);
  current = { id: newId(), name: String(shared.n ?? 'Shared list').slice(0, 60), budget: String(shared.b ?? ''), items, savedAt: Date.now() };
  history.replaceState(null, '', location.pathname);
}

nameInput.value = current.name;
budgetInput.value = current.budget;
initCurrency();
onCurrency(() => {
  renderItems();
  renderSummary();
  renderLists();
});
changed();
renderLists();
