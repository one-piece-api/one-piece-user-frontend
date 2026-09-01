import {
  detectBrowserLocale,
  persistLocale,
  readStoredLocale,
  resolveInitialLocale,
} from './locale';

function setBrowserLanguage(language: string): void {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
  Object.defineProperty(window.navigator, 'languages', {
    value: [language],
    configurable: true,
  });
}

describe('locale', () => {
  const originalLanguage = window.navigator.language;
  const originalLanguages = window.navigator.languages;

  afterEach(() => {
    localStorage.clear();
    setBrowserLanguage(originalLanguage);
    Object.defineProperty(window.navigator, 'languages', {
      value: originalLanguages,
      configurable: true,
    });
  });

  describe('detectBrowserLocale', () => {
    it("resolves 'it' for an Italian browser locale, any region", () => {
      setBrowserLanguage('it-IT');
      expect(detectBrowserLocale()).toBe('it');

      setBrowserLanguage('it-CH');
      expect(detectBrowserLocale()).toBe('it');
    });

    it("falls back to 'en' for any non-Italian browser locale", () => {
      setBrowserLanguage('en-US');
      expect(detectBrowserLocale()).toBe('en');

      setBrowserLanguage('fr-FR');
      expect(detectBrowserLocale()).toBe('en');
    });
  });

  describe('readStoredLocale / persistLocale', () => {
    it('returns null when nothing was ever saved', () => {
      expect(readStoredLocale()).toBeNull();
    });

    it('round-trips a saved choice', () => {
      persistLocale('it');
      expect(readStoredLocale()).toBe('it');
    });

    it('ignores a stored value that is not one of the supported locales', () => {
      localStorage.setItem('onepiece.lang', 'fr');
      expect(readStoredLocale()).toBeNull();
    });
  });

  describe('resolveInitialLocale', () => {
    it('prefers a saved choice over the browser locale', () => {
      setBrowserLanguage('en-US');
      persistLocale('it');
      expect(resolveInitialLocale()).toBe('it');
    });

    it('falls back to the browser locale on a first visit with nothing saved', () => {
      setBrowserLanguage('it-IT');
      expect(resolveInitialLocale()).toBe('it');
    });
  });
});
