/**
 * Reading form values with consistent validation messages.
 *
 * Fields use: <div data-field> … <input data-k="price"> … <p data-error hidden></p> </div>
 * Errors show once a field has been left (data-touched) or when it holds
 * something invalid, so people aren't scolded while typing their first digit.
 */

import { checkNumber, type NumberRules } from '../calculations/validate';
import { localeDecimal } from './currency';

type Input = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function setError(input: Input, message: string | null) {
  const field = input.closest('[data-field]');
  const el = field?.querySelector<HTMLElement>('[data-error]');
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    if (el) {
      el.textContent = message;
      el.hidden = false;
      if (!el.id) el.id = `err-${Math.random().toString(36).slice(2, 9)}`;
      input.setAttribute('aria-describedby', el.id);
    }
  } else {
    input.removeAttribute('aria-invalid');
    if (el) {
      el.hidden = true;
      el.textContent = '';
      input.removeAttribute('aria-describedby');
    }
  }
}

export class FormReader {
  valid = true;
  /** First problem found, for the result panel. */
  firstProblem: string | null = null;
  /** Prefix for problems, e.g. "Deal B", while reading a row. */
  context: string | null = null;

  constructor(private force = false) {}

  number(input: HTMLInputElement | null | undefined, rules: NumberRules = {}): number | undefined {
    if (!input) return undefined;
    const r = checkNumber(input.value, rules, localeDecimal);
    if (r.ok) {
      setError(input, null);
      return r.value;
    }
    this.valid = false;
    const empty = input.value.trim() === '';
    const show = this.force || input.dataset.touched === '1' || !empty;
    setError(input, show ? r.error : null);
    if (!this.firstProblem) {
      const label = input.closest('[data-field]')?.querySelector('[data-label]')?.textContent?.trim();
      const msg = empty && label ? `Enter the ${label.toLowerCase().replace(/\s*\(optional\)$/, '')}.` : r.error;
      this.firstProblem = this.context ? `${this.context}: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}` : msg;
    }
    return undefined;
  }

  /** Records a problem that isn't tied to one field. */
  fail(message: string) {
    this.valid = false;
    this.firstProblem ??= this.context ? `${this.context}: ${message}` : message;
  }
}

/** Reads every [data-k] input inside root (skipping rows) into a plain object. */
export function readForm(root: ParentNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of root.querySelectorAll<Input>('[data-k]')) {
    if (el.closest('[data-row]') && !(root instanceof HTMLElement && root.matches('[data-row]'))) continue;
    const k = el.dataset.k!;
    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (el.checked) out[k] = el.value;
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      out[k] = el.checked ? '1' : '';
    } else {
      out[k] = el.value;
    }
  }
  return out;
}

export function writeForm(root: ParentNode, values: Record<string, string>) {
  for (const el of root.querySelectorAll<Input>('[data-k]')) {
    if (el.closest('[data-row]') && !(root instanceof HTMLElement && root.matches('[data-row]'))) continue;
    const v = values[el.dataset.k!];
    if (v === undefined) continue;
    if (el instanceof HTMLInputElement && el.type === 'radio') el.checked = el.value === v;
    else if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v === '1';
    else el.value = v;
  }
}

export const field = <T extends Input = HTMLInputElement>(root: ParentNode, k: string) => root.querySelector<T>(`[data-k="${k}"]`);
