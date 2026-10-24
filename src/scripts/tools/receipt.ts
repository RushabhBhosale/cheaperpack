import { roundMoney } from '../../lib/calculations/money';
import { checkNumber } from '../../lib/calculations/validate';
import { OcrError, engineReady, ocrSupported, recognize, slowConnection, type EngineLine } from '../../lib/ocr/client';
import { RECEIPT_CATEGORIES, groupRows, guessCategory, parseReceipt, type ReceiptCategory } from '../../lib/parsing/receipt';
import { clearAll, getAll, put, remove } from '../../lib/storage/idb';
import { newId } from '../../lib/storage/local';
import { getCurrency, initCurrency, locale, localeDecimal, money, onCurrency, pct } from '../../lib/ui/currency';
import { $, $$, h } from '../../lib/ui/dom';
import { bars, empty, notice, stats, verdict } from '../../lib/ui/render';
import { toast } from '../../lib/ui/share';

interface Item {
  id: string;
  name: string;
  amount: string;
  category: ReceiptCategory;
}
interface SavedReceipt {
  id: string;
  store: string;
  date: string;
  currency: string;
  items: { name: string; amount: number; category: ReceiptCategory }[];
  total?: number;
  savedAt: number;
}

const root = $('[data-receipt]')!;
const steps = { start: $('[data-step="start"]')!, reading: $('[data-step="reading"]')!, review: $('[data-step="review"]')! };
const itemsEl = $('[data-items]')!;
const storeEl = $<HTMLInputElement>('[data-store]')!;
const dateEl = $<HTMLInputElement>('[data-date]')!;
const totalEl = $<HTMLInputElement>('[data-total]')!;
const taxEl = $<HTMLInputElement>('[data-tax]')!;
const discountEl = $<HTMLInputElement>('[data-discount]')!;
const analysis = $('[data-analysis]')!;
const live = $('[data-live]')!;

let items: Item[] = [];
let editingId: string | null = null;
let rawText = '';
let scanToken = 0;
let saved: SavedReceipt[] = [];

function showReview() {
  steps.start.hidden = true;
  steps.reading.hidden = true;
  steps.review.hidden = false;
}

const amountOf = (s: string) => {
  const r = checkNumber(s, { min: 0 }, localeDecimal);
  return r.ok && r.value !== undefined ? r.value : null;
};

// ---------------------------------------------------------------- items editor

function renderItems() {
  itemsEl.replaceChildren(
    ...items.map((it) => {
      const name = h('input', { type: 'text', value: it.name, maxlength: 60, 'aria-label': 'Item name', placeholder: 'Item', class: 'min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[15px] outline-none' }) as HTMLInputElement;
      name.addEventListener('input', () => {
        it.name = name.value;
        refresh();
      });
      name.addEventListener('change', () => {
        if (it.category === 'Other') {
          it.category = guessCategory(it.name);
          cat.value = it.category;
          refresh();
        }
      });
      const amount = h('input', { type: 'text', inputmode: 'decimal', value: it.amount, 'aria-label': `Amount for ${it.name || 'item'}`, placeholder: '0.00', class: 'w-24 bg-transparent px-3 py-2.5 text-right text-[15px] tabular-nums outline-none' }) as HTMLInputElement;
      amount.addEventListener('input', () => {
        it.amount = amount.value;
        const bad = it.amount.trim() !== '' && amountOf(it.amount) === null;
        amount.setAttribute('aria-invalid', String(bad));
        box.classList.toggle('!border-bad', bad);
        refresh();
      });
      const cat = h(
        'select',
        { 'aria-label': `Category for ${it.name || 'item'}`, class: 'w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] text-ink-2' },
        ...RECEIPT_CATEGORIES.map((c) => h('option', { value: c, selected: c === it.category }, c)),
      ) as HTMLSelectElement;
      cat.addEventListener('change', () => {
        it.category = cat.value as ReceiptCategory;
        refresh();
      });
      const del = h('button', { type: 'button', class: 'icon-btn !size-10', 'aria-label': `Remove ${it.name || 'item'}` }, '×');
      del.addEventListener('click', () => {
        items = items.filter((x) => x !== it);
        renderItems();
        refresh();
      });
      const box = h('div', { class: 'ui-box !min-h-11' }, name, h('span', { class: 'h-6 w-px bg-line', 'aria-hidden': 'true' }), h('span', { class: 'pl-3 text-muted', 'data-cur': '' }, '₹'), amount);
      return h('li', { class: 'grid grid-cols-[1fr_auto] items-start gap-x-1 gap-y-1.5' }, box, del, h('div', { class: 'col-span-2 max-w-[14rem]' }, cat));
    }),
  );
  for (const el of $$('[data-cur]', itemsEl)) el.textContent = currencySymbol();
}

function currencySymbol() {
  return $('[data-cur]')?.textContent ?? '₹';
}

function itemsSum() {
  return roundMoney(items.reduce((t, i) => t + (amountOf(i.amount) ?? 0), 0));
}

function refresh() {
  const sum = itemsSum();
  $('[data-items-sum]')!.textContent = items.length ? money(sum, { exact: true }) : '—';
  const total = amountOf(totalEl.value);
  const tax = amountOf(taxEl.value) ?? 0;
  const discount = amountOf(discountEl.value) ?? 0;
  const check = $('[data-check]')!;
  if (total !== null && items.length) {
    const diff = roundMoney(total - (sum + tax - discount));
    const tol = Math.max(1, total * 0.01);
    // Some receipts list tax that's already included in the item prices.
    if (Math.abs(diff) > tol && tax && Math.abs(roundMoney(total - (sum - discount))) <= tol) {
      check.className = 'mt-2 text-[14px] text-good';
      check.textContent = '✓ Items match the total. The tax shown is already included in the prices, so you can clear the tax field.';
      renderAnalysis();
      return;
    }
    check.className = `mt-2 text-[14px] ${Math.abs(diff) <= Math.max(1, total * 0.01) ? 'text-good' : 'text-warn'}`;
    check.textContent =
      Math.abs(diff) <= Math.max(1, total * 0.01)
        ? Math.abs(diff) < 0.005
          ? tax || discount
            ? '✓ Items, tax and discounts match the receipt total.'
            : '✓ Items match the receipt total.'
          : `✓ Items match the total within ${money(Math.abs(diff), { exact: true })} (rounding, tax or discount).`
        : diff > 0
          ? `Items are ${money(diff, { exact: true })} short of the total. Tax or a missed item? Add it if needed.`
          : `Items are ${money(-diff, { exact: true })} more than the total. A discount, or a misread amount?`;
  } else check.textContent = '';
  renderAnalysis();
}

function renderAnalysis() {
  const valid = items.map((i) => ({ ...i, value: amountOf(i.amount) })).filter((i) => i.value !== null && i.value > 0) as (Item & { value: number })[];
  if (!valid.length) {
    analysis.replaceChildren(empty('Scan or enter a receipt to see the total, categories and biggest items.'));
    return;
  }
  const sum = valid.reduce((t, i) => t + i.value, 0);
  const total = amountOf(totalEl.value) ?? sum;
  const byCat = new Map<string, number>();
  for (const i of valid) byCat.set(i.category, (byCat.get(i.category) ?? 0) + i.value);
  const cats = [...byCat].sort((a, b) => b[1] - a[1]);
  const top = [...valid].sort((a, b) => b.value - a.value).slice(0, 3);
  analysis.replaceChildren(
    verdict({ badge: 'Receipt total', tone: 'plain', value: money(total, { exact: true }), lines: [`${valid.length} item${valid.length === 1 ? '' : 's'}${storeEl.value.trim() ? ` at ${storeEl.value.trim()}` : ''}`] }),
    h('h3', { class: 'eyebrow mt-5' }, 'By category'),
    bars(cats.map(([c, v], i) => ({ label: c, value: `${money(v)} · ${pct(v / sum, 0)}`, fraction: v / sum, highlight: i === 0 }))),
    h('h3', { class: 'eyebrow mt-5' }, 'Most expensive'),
    h('ol', { class: 'mt-2 grid gap-1.5 text-[15px]' }, ...top.map((i) => h('li', { class: 'flex justify-between gap-3' }, h('span', { class: 'truncate' }, i.name || 'Item'), h('span', { class: 'stat shrink-0 font-semibold' }, money(i.value, { exact: true }))))),
  );
}

function startReview(opts: { store?: string; date?: string; total?: number; tax?: number; discount?: number; newItems: Item[]; append?: boolean; messages?: Node[] }) {
  const fill = (el: HTMLInputElement, v: number | undefined) => (el.value = v ? v.toFixed(2) : '');
  if (!opts.append) {
    editingId = null;
    items = [];
    storeEl.value = opts.store ?? '';
    dateEl.value = opts.date ?? new Date().toISOString().slice(0, 10);
    fill(totalEl, opts.total);
    fill(taxEl, opts.tax);
    fill(discountEl, opts.discount);
  } else {
    if (opts.total !== undefined && !totalEl.value) fill(totalEl, opts.total);
    if (opts.tax && !taxEl.value) fill(taxEl, opts.tax);
    if (opts.discount && !discountEl.value) fill(discountEl, opts.discount);
  }
  items.push(...opts.newItems);
  if (!items.length) items.push({ id: newId(), name: '', amount: '', category: 'Other' });
  $('[data-messages]')!.replaceChildren(...(opts.messages ?? []));
  showReview();
  renderItems();
  refresh();
}

// ---------------------------------------------------------------- scanning

const FAILURES: Record<OcrError['code'], string> = {
  unsupported: 'Scanning isn’t supported in this browser. You can enter the receipt by hand.',
  image: 'This image couldn’t be opened. Try a JPG or PNG photo, or enter the receipt by hand.',
  engine: 'The scanner couldn’t load on this device. You can enter the receipt by hand.',
  offline: 'You’re offline, so the scanner couldn’t download. You can enter the receipt by hand.',
  scan: 'Something went wrong while reading the photo. Try another photo, or enter the receipt by hand.',
};

async function scan(file: File, append: boolean) {
  const token = ++scanToken;
  const thumb = $<HTMLImageElement>('[data-thumb]')!;
  const url = URL.createObjectURL(file);
  thumb.src = url;
  steps.start.hidden = true;
  steps.review.hidden = true;
  steps.reading.hidden = false;
  const text = $('[data-progress-text]')!;
  const bar = $('[data-progress-bar]')!;
  const setProgress = (t: string, f: number | null) => {
    text.textContent = t;
    bar.classList.toggle('animate-pulse', f === null);
    bar.style.width = f === null ? '33%' : `${Math.round(f * 100)}%`;
  };
  setProgress('Preparing the photo…', null);
  try {
    // Receipts are tall with small print: keep more pixels than for a price tag.
    const lines = await recognize(file, {
      maxSide: 2400,
      detLimitSideLen: 1600,
      detLimitType: 'max',
      onProgress: (s) => {
        if (token !== scanToken) return;
        if (s.phase === 'engine') setProgress('Loading the scanner…', null);
        else if (s.phase === 'models') setProgress(`Downloading the scanner… ${Math.round((s.fraction ?? 0) * 100)}%`, s.fraction);
        else setProgress('Reading the receipt…', null);
      },
    });
    if (token !== scanToken) return;
    handleLines(lines, append);
  } catch (err) {
    if (token !== scanToken) return;
    steps.reading.hidden = true;
    startReview({ newItems: [], append, messages: [notice(FAILURES[(err as OcrError).code ?? 'scan'] ?? FAILURES.scan, 'bad')] });
  } finally {
    URL.revokeObjectURL(url);
    thumb.removeAttribute('src');
  }
}

function handleLines(lines: EngineLine[], append: boolean) {
  steps.reading.hidden = true;
  const confident = lines.filter((l) => l.text.trim() && l.score >= 0.5);
  const rows = groupRows(confident.map((l) => ({ text: l.text, score: l.score, x: l.x, y: l.y, w: l.w, h: l.height })));
  rawText = [append ? rawText : '', rows.join('\n')].filter(Boolean).join('\n\n');
  const raw = $('[data-raw]')!;
  raw.textContent = rawText;
  $('[data-raw-wrap]')!.hidden = !rawText;

  const parsed = parseReceipt(rows);
  const messages: Node[] = [];
  if (!rows.length) messages.push(notice('No text found. Try again with the receipt flat, in good light and filling the frame, or enter the items by hand.', 'warn'));
  else {
    for (const w of parsed.warnings) messages.push(notice(w, 'warn'));
    if (parsed.items.length) messages.push(notice(`Found ${parsed.items.length} item${parsed.items.length === 1 ? '' : 's'}. Check each one: scans can misread letters and numbers.`, 'info'));
  }
  startReview({
    store: parsed.store,
    date: parsed.date,
    total: parsed.total,
    tax: parsed.tax,
    discount: parsed.discount,
    append,
    newItems: parsed.items.map((i) => ({ id: newId(), name: i.qty && i.qty > 1 ? `${i.name} × ${i.qty}` : i.name, amount: i.amount.toFixed(2), category: i.category })),
    messages,
  });
}

for (const input of $$<HTMLInputElement>('[data-file]', root)) {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void scan(file, false);
  });
}
$<HTMLInputElement>('[data-file-more]')!.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void scan(file, true);
});
$('[data-manual]')!.addEventListener('click', () => {
  rawText = '';
  $('[data-raw-wrap]')!.hidden = true;
  startReview({ newItems: [] });
  itemsEl.querySelector('input')?.focus();
});
$('[data-cancel]')!.addEventListener('click', () => {
  scanToken++;
  steps.reading.hidden = true;
  startReview({ newItems: [] });
});
$('[data-add-item]')!.addEventListener('click', () => {
  items.push({ id: newId(), name: '', amount: '', category: 'Other' });
  renderItems();
  refresh();
  itemsEl.querySelector<HTMLInputElement>('li:last-child input')?.focus();
});
totalEl.addEventListener('input', refresh);
taxEl.addEventListener('input', refresh);
discountEl.addEventListener('input', refresh);
storeEl.addEventListener('input', renderAnalysis);
$('[data-restart]')!.addEventListener('click', () => {
  if (items.some((i) => i.name || i.amount) && !window.confirm('Discard this receipt?')) return;
  items = [];
  editingId = null;
  steps.review.hidden = true;
  steps.start.hidden = false;
  renderAnalysis();
});

// ---------------------------------------------------------------- saving and history

$('[data-save]')!.addEventListener('click', async () => {
  const clean = items
    .map((i) => ({ name: i.name.trim() || 'Item', amount: amountOf(i.amount), category: i.category }))
    .filter((i): i is { name: string; amount: number; category: ReceiptCategory } => i.amount !== null && i.amount > 0);
  const bad = items.find((i) => i.amount.trim() !== '' && amountOf(i.amount) === null);
  if (bad) return toast(`Fix the amount for “${bad.name || 'an item'}” first`);
  if (!clean.length) return toast('Add at least one item with an amount');
  const receipt: SavedReceipt = {
    id: editingId ?? newId(),
    store: storeEl.value.trim().slice(0, 60),
    date: /^\d{4}-\d{2}-\d{2}$/.test(dateEl.value) ? dateEl.value : '',
    currency: getCurrency(),
    items: clean,
    total: amountOf(totalEl.value) ?? undefined,
    savedAt: Date.now(),
  };
  await put(receipt);
  toast('Receipt saved on this device');
  items = [];
  editingId = null;
  steps.review.hidden = true;
  steps.start.hidden = false;
  renderAnalysis();
  await loadSaved();
  $('[data-saved-wrap]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

const receiptTotal = (r: SavedReceipt) => r.total ?? r.items.reduce((t, i) => t + i.amount, 0);

async function loadSaved() {
  const all = await getAll<SavedReceipt>();
  saved = all.filter((r) => r && Array.isArray(r.items)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.savedAt - a.savedAt);
  renderSaved();
}

function renderSaved() {
  $('[data-saved-wrap]')!.hidden = saved.length === 0;
  $('[data-all-wrap]')!.hidden = saved.length === 0;
  const fmtDate = (d: string) => (d ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${d}T00:00`)) : 'No date');
  $('[data-saved]')!.replaceChildren(
    ...saved.map((r) => {
      const open = h(
        'button',
        { type: 'button', class: 'min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition hover:bg-subtle' },
        h('span', { class: 'block truncate text-[15px] font-medium' }, r.store || 'Receipt'),
        h('span', { class: 'block text-[13px] text-muted' }, `${fmtDate(r.date)} · ${r.items.length} items · ${money(receiptTotal(r), { exact: true, currency: r.currency })}`),
      );
      open.addEventListener('click', () => {
        rawText = '';
        $('[data-raw-wrap]')!.hidden = true;
        startReview({ store: r.store, date: r.date, total: r.total, newItems: r.items.map((i) => ({ id: newId(), name: i.name, amount: i.amount.toFixed(2), category: i.category })) });
        editingId = r.id;
        root.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete receipt ${r.store || ''} ${fmtDate(r.date)}` }, '×');
      del.addEventListener('click', async () => {
        await remove(r.id);
        toast('Receipt deleted');
        await loadSaved();
      });
      return h('li', { class: 'flex items-center gap-1 pr-1' }, open, del);
    }),
  );

  // Spending across receipts in the current currency.
  const cur = getCurrency();
  const inCur = saved.filter((r) => r.currency === cur);
  const other = saved.length - inCur.length;
  if (!inCur.length) {
    $('[data-all]')!.replaceChildren(empty(other ? `Your saved receipts are in other currencies. Switch currency to see them.` : ''));
    return;
  }
  const total = inCur.reduce((t, r) => t + receiptTotal(r), 0);
  const byCat = new Map<string, number>();
  for (const r of inCur) for (const i of r.items) byCat.set(i.category, (byCat.get(i.category) ?? 0) + i.amount);
  const itemTotal = [...byCat.values()].reduce((a, b) => a + b, 0);
  const byMonth = new Map<string, number>();
  for (const r of inCur) {
    const key = (r.date || new Date(r.savedAt).toISOString()).slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + receiptTotal(r));
  }
  const months = [...byMonth].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const maxMonth = Math.max(...months.map((m) => m[1]));
  const monthName = (k: string) => new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(`${k}-01T00:00`));
  $('[data-all]')!.replaceChildren(
    stats([
      { label: 'Spent', value: money(total), strong: true },
      { label: 'Receipts', value: String(inCur.length), note: other ? `${other} in other currencies` : undefined },
    ]),
    h('h3', { class: 'eyebrow mt-5' }, 'By category'),
    bars([...byCat].sort((a, b) => b[1] - a[1]).map(([c, v], i) => ({ label: c, value: `${money(v)} · ${pct(v / itemTotal, 0)}`, fraction: v / itemTotal, highlight: i === 0 }))),
    h('h3', { class: 'eyebrow mt-5' }, 'By month'),
    bars(months.map(([k, v]) => ({ label: monthName(k), value: money(v), fraction: v / maxMonth }))),
  );
  live.textContent = `${inCur.length} saved receipts, ${money(total)} in total.`;
}

$('[data-delete-all]')!.addEventListener('click', async () => {
  if (!window.confirm('Delete all saved receipts from this device? This can’t be undone.')) return;
  await clearAll();
  toast('All receipts deleted');
  await loadSaved();
});

// ---------------------------------------------------------------- start

if (!ocrSupported()) {
  $('[data-start-note]')!.textContent = 'Scanning isn’t supported in this browser, but you can enter receipts by hand.';
  for (const l of $$('label', steps.start)) l.hidden = true;
} else if (!engineReady() && slowConnection()) {
  $('[data-start-note]')!.textContent = 'Data saver is on: the first scan downloads about 13 MB. Photos are read on this device and never uploaded.';
}
initCurrency();
onCurrency(() => {
  renderItems();
  refresh();
  renderSaved();
});
void loadSaved();
