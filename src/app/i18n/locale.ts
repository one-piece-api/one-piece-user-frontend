import { getBrowserCultureLang } from '@jsverse/transloco';

export const AVAILABLE_LOCALES = ['it', 'en'] as const;
export type AppLocale = (typeof AVAILABLE_LOCALES)[number];

const STORAGE_KEY = 'onepiece.lang';

function isAppLocale(value: string | null): value is AppLocale {
  return (AVAILABLE_LOCALES as readonly string[]).includes(value ?? '');
}

/** Italian for an Italian browser/OS locale (`it-IT`, `it-CH`, ...), English otherwise -
 * the same `Accept-Language`-style negotiation Keycloak's own login pages already use. */
export function detectBrowserLocale(): AppLocale {
  return getBrowserCultureLang().toLowerCase().startsWith('it') ? 'it' : 'en';
}

export function readStoredLocale(): AppLocale | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isAppLocale(stored) ? stored : null;
}

export function persistLocale(locale: AppLocale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

/** A saved choice always wins; only a first visit (nothing saved yet) falls back to the
 * browser/OS locale. */
export function resolveInitialLocale(): AppLocale {
  return readStoredLocale() ?? detectBrowserLocale();
}
