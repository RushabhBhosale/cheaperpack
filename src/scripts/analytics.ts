/**
 * Google Analytics 4 (gtag.js). Loaded on every page from Base.astro.
 *
 * The page address is sent without its #fragment: share links keep
 * calculation values there, and those must never leave the device.
 */

const MEASUREMENT_ID = 'G-J8LMKCM7YX';

const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
w.dataLayer = w.dataLayer || [];
// gtag.js expects the `arguments` object itself, not an array.
w.gtag = function gtag() {
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
};
w.gtag('js', new Date());
w.gtag('config', MEASUREMENT_ID, { page_location: location.origin + location.pathname + location.search });
