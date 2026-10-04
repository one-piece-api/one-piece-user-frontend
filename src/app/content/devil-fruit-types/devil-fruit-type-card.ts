import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { LanguageEntry } from '../language-catalog';
import {
  LONG_TEXT_FIELDS,
  isTranslationComplete,
  type DevilFruitType,
  type LongTextField,
} from './devil-fruit-type.model';

/** What the card says where a language has no such text yet. */
const EMPTY_TEXT_KEY: Record<LongTextField, string> = {
  description: 'content.card.noDescription',
  advantages: 'content.card.noAdvantages',
  disadvantages: 'content.card.noDisadvantages',
};

/** One language tab of the card. */
interface LanguageTab {
  readonly code: string;
  readonly label: string;
  readonly name: string;
  readonly selected: boolean;
  readonly incomplete: boolean;
}

/**
 * The card of a Devil Fruit Type version: its name, description, advantages and disadvantages,
 * one language at a time.
 * The tabs are the language catalog; a dot marks a language whose translation is incomplete.
 */
@Component({
  selector: 'app-devil-fruit-type-card',
  templateUrl: './devil-fruit-type-card.html',
  imports: [TranslocoPipe],
})
export class DevilFruitTypeCard {
  private readonly transloco = inject(TranslocoService);

  readonly devilFruitType = input.required<DevilFruitType>();
  readonly languages = input.required<readonly LanguageEntry[]>();

  /** The language shown: the UI's own when the catalog has it, until the reader picks another. */
  protected readonly language = linkedSignal<string | null>(() => {
    const codes = this.languages().map((language) => language.code);
    const uiLanguage = this.transloco.activeLang();
    return codes.includes(uiLanguage) ? uiLanguage : (codes[0] ?? null);
  });

  protected readonly tabs = computed<LanguageTab[]>(() =>
    this.languages().map(({ code, name }) => ({
      code,
      label: code.toUpperCase(),
      name,
      selected: code === this.language(),
      incomplete: !isTranslationComplete(this.devilFruitType().translations[code]),
    })),
  );

  protected readonly languageLabel = computed(() => this.language()?.toUpperCase() ?? '');

  private readonly translation = computed(
    () => this.devilFruitType().translations[this.language() ?? ''],
  );
  protected readonly name = computed(() => this.translation()?.name?.trim() || null);
  /** The long texts of the language shown, in reading order; `text` is null when not written. */
  protected readonly longTexts = computed(() =>
    LONG_TEXT_FIELDS.map((field) => ({
      field,
      text: this.translation()?.[field]?.trim() || null,
      emptyKey: EMPTY_TEXT_KEY[field],
    })),
  );
}
