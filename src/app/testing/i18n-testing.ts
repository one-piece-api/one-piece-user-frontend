import { TranslocoTestingModule, type Translation } from '@jsverse/transloco';
import en from '../../../public/i18n/en.json';
import it from '../../../public/i18n/it.json';

/**
 * Real catalogs, not stub keys - so a spec asserting on rendered copy (e.g. "Crew Manifest")
 * keeps working unchanged, the same way it did before every string moved into `| transloco`.
 * Defaults to English: jsdom's `navigator.language` is `en-US`, matching what the app itself
 * would resolve to via `resolveInitialLocale()` in a real English-locale browser.
 */
export function provideTranslocoTesting() {
  return TranslocoTestingModule.forRoot({
    langs: { en: en as Translation, it: it as Translation },
    preloadLangs: true,
    translocoConfig: {
      availableLangs: ['it', 'en'],
      defaultLang: 'en',
      fallbackLang: 'en',
      reRenderOnLangChange: true,
    },
  });
}
