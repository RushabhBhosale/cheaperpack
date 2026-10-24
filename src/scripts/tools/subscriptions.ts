import { CYCLE_MONTHS, compareAnnualPlan, nextRenewal, summarise, type Cycle, type Subscription } from '../../lib/calculations/subscriptions';
import { newId, readJSON, removeKey, writeJSON } from '../../lib/storage/local';
import { initCurrency, locale, money, num, onCurrency, pct } from '../../lib/ui/currency';
import { $, h } from '../../lib/ui/dom';
import { FormReader, field, setError } from '../../lib/ui/fields';
import { bars, empty, notice, stats, verdict } from '../../lib/ui/render';
import { toast } from '../../lib/ui/share';

const KEY = 'subscriptions';
const CYCLE_LABEL: Record<Cycle, string> = { monthly: 'a month', quarterly: 'every 3 months', yearly: 'a year', weekly: 'a week' };
const isCycle = (c: unknown): c is Cycle => typeof c === 'string' && c in CYCLE_MONTHS;

const form = $<HTMLFormElement>('[data-sub-form]')!;
const list = $('[data-list]')!;
const listEmpty = $('[data-list-empty]')!;
const summary = $('[data-summary]')!;
const clear = $<HTMLButtonElement>('[data-clear]')!;
const submit = $<HTMLButtonElement>('[data-submit]')!;
const cancelEdit = $<HTMLButtonElement>('[data-cancel-edit]')!;
const formTitle = $('[data-form-title]')!;
const live = $('[data-live]')!;

let subs: Subscription[] = load();
let editing: string | null = null;

function load(): Subscription[] {
  const raw = readJSON<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is Subscription => !!s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.amount === 'number' && s.amount >= 0 && isCycle(s.cycle),
  );
}

const save = () => writeJSON(KEY, subs);

function renderList() {
  listEmpty.hidden = subs.length > 0;
  list.hidden = subs.length === 0;
  clear.hidden = subs.length === 0;
  const today = new Date();
  list.replaceChildren(
    ...summarise(subs).ranked.map((s) => {
      const next = s.renewal ? nextRenewal(s.renewal, s.cycle, today) : null;
      const when = next ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(next) : null;
      const cancel = h('input', { type: 'checkbox', class: 'size-5 accent-accent', 'aria-label': `Consider cancelling ${s.name}` }) as HTMLInputElement;
      cancel.checked = !!s.cancel;
      cancel.addEventListener('change', () => {
        subs = subs.map((x) => (x.id === s.id ? { ...x, cancel: cancel.checked } : x));
        save();
        renderSummary();
      });
      const edit = h('button', { type: 'button', class: 'btn btn-ghost !min-h-9 !px-2 !text-[13px]', 'aria-label': `Edit ${s.name}` }, 'Edit');
      edit.addEventListener('click', () => startEdit(s));
      const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${s.name}` }, '×');
      del.addEventListener('click', () => {
        subs = subs.filter((x) => x.id !== s.id);
        save();
        render();
        toast(`${s.name} deleted`);
      });
      return h(
        'li',
        { class: 'flex items-center gap-3 px-4 py-3' },
        h(
          'div',
          { class: 'min-w-0 flex-1' },
          h('p', { class: 'truncate text-[15px] font-semibold' }, s.name),
          h('p', { class: 'text-[13px] text-muted' }, `${money(s.amount)} ${CYCLE_LABEL[s.cycle]}${s.cycle !== 'monthly' ? ` · ${money(s.monthly)}/mo` : ''}${s.category ? ` · ${s.category}` : ''}${when ? ` · renews ${when}` : ''}`),
          h('label', { class: 'mt-1 inline-flex items-center gap-2 text-[13px] text-ink-2' }, cancel, 'Consider cancelling'),
        ),
        h('div', { class: 'flex shrink-0 items-center' }, edit, del),
      );
    }),
  );
}

function renderSummary() {
  if (subs.length === 0) {
    summary.replaceChildren(empty('Add subscriptions to see your monthly and yearly total.'));
    return;
  }
  const s = summarise(subs);
  const nodes: Node[] = [
    verdict({ badge: 'You spend', tone: 'plain', value: money(s.monthly), unit: 'a month', lines: [`${money(s.yearly)} a year on ${subs.length} subscription${subs.length === 1 ? '' : 's'}`] }),
  ];
  if (s.cancelCount) {
    nodes.push(
      h(
        'div',
        { class: 'mt-4 rounded-xl bg-good-soft px-4 py-3' },
        h('p', { class: 'text-[13px] font-semibold text-good' }, `Cancelling ${s.cancelCount} would save`),
        h('p', { class: 'stat text-[24px] font-bold text-good' }, `${money(s.cancelMonthly)}`, h('span', { class: 'text-[15px] font-medium' }, ' a month')),
        h('p', { class: 'text-[14px] text-good' }, `${money(s.cancelYearly)} a year`),
      ),
    );
  }
  nodes.push(h('h3', { class: 'eyebrow mt-5' }, 'Most expensive'));
  nodes.push(bars(s.ranked.slice(0, 5).map((x, i) => ({ label: x.name, value: `${money(x.monthly)}/mo · ${pct(x.share, 0)}`, fraction: x.share, highlight: i === 0 }))));
  if (s.byCategory.length > 1) {
    nodes.push(h('h3', { class: 'eyebrow mt-5' }, 'By category'));
    nodes.push(bars(s.byCategory.map((c) => ({ label: c.category, value: `${money(c.monthly)}/mo`, fraction: c.share }))));
  }
  const today = new Date();
  const soon = subs
    .map((x) => ({ x, d: x.renewal ? nextRenewal(x.renewal, x.cycle, today) : null }))
    .filter((r) => r.d && (r.d.getTime() - today.getTime()) / 86400000 <= 30)
    .sort((a, b) => a.d!.getTime() - b.d!.getTime());
  if (soon.length) {
    const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    nodes.push(notice(`Renewing in the next 30 days: ${soon.map((r) => `${r.x.name} (${fmt.format(r.d!)}, ${money(r.x.amount)})`).join(', ')}.`, 'info'));
  }
  summary.replaceChildren(...nodes);
  live.textContent = `${money(s.monthly)} a month, ${money(s.yearly)} a year.`;
}

function render() {
  renderList();
  renderSummary();
}

function startEdit(s: Subscription) {
  editing = s.id;
  field(form, 'name')!.value = s.name;
  field(form, 'amount')!.value = String(s.amount);
  field<HTMLSelectElement>(form, 'cycle')!.value = s.cycle;
  field<HTMLSelectElement>(form, 'category')!.value = s.category ?? 'Other';
  field(form, 'renewal')!.value = s.renewal ?? '';
  formTitle.textContent = `Edit ${s.name}`;
  submit.textContent = 'Save changes';
  cancelEdit.hidden = false;
  form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  field(form, 'name')!.focus({ preventScroll: true });
}

function resetForm() {
  editing = null;
  form.reset();
  for (const el of form.querySelectorAll<HTMLInputElement>('input')) {
    el.value = '';
    delete el.dataset.touched;
    setError(el, null);
  }
  field<HTMLSelectElement>(form, 'cycle')!.value = 'monthly';
  formTitle.textContent = 'Add a subscription';
  submit.textContent = 'Add subscription';
  cancelEdit.hidden = true;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const r = new FormReader(true);
  const nameEl = field(form, 'name')!;
  const name = nameEl.value.trim();
  if (!name) {
    setError(nameEl, 'Enter a name.');
    r.fail('name');
  } else setError(nameEl, null);
  const amount = r.number(field(form, 'amount'), { min: 0, label: 'amount' });
  const renewal = field(form, 'renewal')!.value;
  if (!r.valid || amount === undefined) {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return;
  }
  const cycleVal = field<HTMLSelectElement>(form, 'cycle')!.value;
  const sub: Subscription = {
    id: editing ?? newId(),
    name: name.slice(0, 60),
    amount,
    cycle: isCycle(cycleVal) ? cycleVal : 'monthly',
    category: field<HTMLSelectElement>(form, 'category')!.value,
    renewal: /^\d{4}-\d{2}-\d{2}$/.test(renewal) ? renewal : undefined,
    cancel: subs.find((x) => x.id === editing)?.cancel,
  };
  subs = editing ? subs.map((x) => (x.id === editing ? sub : x)) : [...subs, sub];
  save();
  toast(editing ? 'Saved' : `${sub.name} added`);
  resetForm();
  render();
  field(form, 'name')!.focus();
});

cancelEdit.addEventListener('click', resetForm);
form.addEventListener('focusout', (e) => {
  const t = e.target as HTMLElement;
  if (t.matches('input')) t.dataset.touched = '1';
});
clear.addEventListener('click', () => {
  if (!window.confirm('Delete all subscriptions from this device?')) return;
  subs = [];
  removeKey(KEY);
  render();
  toast('All subscriptions deleted');
});

// Monthly vs annual plan
const plan = $('[data-plan]')!;
const planResult = $('[data-plan-result]')!;
function renderPlan() {
  const r = new FormReader(false);
  const m = r.number(field(plan, 'pm'), { above: 0, label: 'monthly price' });
  const a = r.number(field(plan, 'pa'), { above: 0, label: 'annual price' });
  if (m === undefined || a === undefined) {
    planResult.textContent = 'Enter both prices to compare.';
    return;
  }
  const c = compareAnnualPlan(m, a);
  planResult.replaceChildren(
    c.saving > 0
      ? h('span', null, h('strong', { class: 'text-good' }, `The annual plan saves ${money(c.saving)} (${pct(c.savingFraction)})`), ` compared with 12 months at ${money(m)} (${money(c.monthlyForYear)}). It pays off if you keep it longer than ${num(c.breakEvenMonths, 1)} months.`)
      : c.saving < 0
        ? h('span', null, h('strong', null, `The monthly plan is cheaper`), `: 12 months cost ${money(c.monthlyForYear)}, ${money(-c.saving)} less than the annual price.`)
        : 'Both cost the same over a year.',
  );
}
plan.addEventListener('input', renderPlan);
plan.addEventListener('focusout', (e) => {
  (e.target as HTMLElement).dataset.touched = '1';
  renderPlan();
});

initCurrency();
onCurrency(() => {
  render();
  renderPlan();
});
render();
