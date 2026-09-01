import { Injectable, effect, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AVAILABLE_LOCALES, persistLocale, type AppLocale } from './locale';

/**
 * Keeps `<html lang>` in sync with the active Transloco language and persists a manual
 * switch (`locale.ts`'s `resolveInitialLocale` reads it back on the next visit) - the
 * language switcher just calls `setLanguage`, everything else follows from the signal.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly available = AVAILABLE_LOCALES;
  readonly active = this.transloco.activeLang;

  constructor() {
    effect(() => {
      document.documentElement.lang = this.active();
    });
  }

  setLanguage(locale: AppLocale): void {
    this.transloco.setActiveLang(locale);
    persistLocale(locale);
  }
}
