import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service';
import type { AppLocale } from '../../i18n/locale';

/** The sidebar's IT/EN toggle - two pill buttons rather than a `<select>`, since there are
 * only ever two languages and a toggle reads its current state at a glance. */
@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.html',
  imports: [TranslocoPipe],
})
export class LanguageSwitcher {
  protected readonly languageService = inject(LanguageService);

  protected select(locale: AppLocale): void {
    this.languageService.setLanguage(locale);
  }
}
