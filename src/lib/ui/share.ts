/** Share links (state in the #fragment, never sent to the server) and toasts. */

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeState(state: unknown): string {
  return `s=${toBase64Url(JSON.stringify(state))}`;
}

export function decodeState<T>(hash: string): T | null {
  const m = hash.match(/(?:^#?|&)s=([\w-]+)/);
  if (!m) return null;
  try {
    return JSON.parse(fromBase64Url(m[1]!)) as T;
  } catch {
    return null;
  }
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;

export function toast(text: string) {
  if (!toastEl) {
    const wrap = document.createElement('div');
    wrap.className = 'pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4';
    toastEl = document.createElement('div');
    toastEl.className = 'ui-fade rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-white';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    wrap.append(toastEl);
    document.body.append(wrap);
  }
  toastEl.textContent = text;
  toastEl.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl && (toastEl.hidden = true), 2400);
}

/** Native share sheet on phones, otherwise copy to clipboard. */
export async function shareLink(url: string, title: string, text: string) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    window.prompt('Copy this link', url);
  }
}

/** Offers a text file for download, created in the browser. */
export function downloadText(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
