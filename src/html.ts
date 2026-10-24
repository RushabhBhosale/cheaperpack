/** Tiny HTML templating: values are escaped unless they are already `Html`. */
export interface Html { readonly __html: string }

export const raw = (s: string): Html => ({ __html: s });
export const isHtml = (v: unknown): v is Html => typeof v === 'object' && v !== null && '__html' in v;

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Value = string | number | boolean | null | undefined | Html | Value[];

function render(v: Value): string {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (isHtml(v)) return v.__html;
  return esc(v);
}

export function html(strings: TemplateStringsArray, ...values: Value[]): Html {
  let out = strings[0] ?? '';
  values.forEach((v, i) => (out += render(v) + (strings[i + 1] ?? '')));
  return { __html: out };
}

/** For JSON-LD inside <script>: never allow `</script>` or HTML comments to end the block. */
export const jsonScript = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export const truncate = (s: string, max: number): string => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).replace(/[\s,;:–-]+$/, '')}…`;
};

export const fmtDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
