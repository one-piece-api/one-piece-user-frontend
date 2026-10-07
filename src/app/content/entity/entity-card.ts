import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { LanguageEntry } from '../language-catalog';
import { ENTITY } from './entities';
import { isTranslationComplete, localizedFields, type EntityBody } from './entity-body';
import { textOf } from './field-kinds';

/** One language tab of the card. */
interface LanguageTab {
  readonly code: string;
  readonly label: string;
  readonly name: string;
  readonly selected: boolean;
  readonly incomplete: boolean;
}

/** A long text of the language shown; `text` is null when not written. */
interface LongText {
  readonly field: string;
  readonly text: string | null;
  /** What the card says where the language has no such text yet: `content.card.noDescription`. */
  readonly emptyKey: string;
}

/** A row of the card: a long text across it, or two side by side. */
type Block =
  | { readonly layout: 'wide'; readonly text: LongText }
  | { readonly layout: 'pair'; readonly texts: LongText[] };

/**
 * The card of a version of any entity: its name, then its long texts as the definition lays
 * them out, one language at a time. The tabs are the language catalog; a dot marks a
 * language whose translation is incomplete.
 */
@Component({
  selector: 'app-entity-card',
  templateUrl: './entity-card.html',
  imports: [NgTemplateOutlet, TranslocoPipe],
})
export class EntityCard {
  private readonly transloco = inject(TranslocoService);
  private readonly entity = inject(ENTITY);

  readonly body = input.required<EntityBody>();
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
      incomplete: !isTranslationComplete(this.entity, this.body().translations[code]),
    })),
  );

  protected readonly languageLabel = computed(() => this.language()?.toUpperCase() ?? '');

  private readonly translation = computed(() => this.body().translations[this.language() ?? '']);
  protected readonly name = computed(() => textOf(this.translation()?.['name']).trim() || null);

  /** The long texts in reading order: each wide one alone, side by side those in a pair. */
  protected readonly blocks = computed<Block[]>(() => {
    const blocks: Block[] = [];
    for (const field of localizedFields(this.entity)) {
      if (field.kind !== 'localizedText' || !field.layout) {
        continue;
      }
      const text: LongText = {
        field: field.key,
        text: textOf(this.translation()?.[field.key]).trim() || null,
        emptyKey: `content.card.no${field.key[0].toUpperCase()}${field.key.slice(1)}`,
      };
      const last = blocks.at(-1);
      if (field.layout === 'wide') {
        blocks.push({ layout: 'wide', text });
      } else if (last?.layout === 'pair') {
        last.texts.push(text);
      } else {
        blocks.push({ layout: 'pair', texts: [text] });
      }
    }
    return blocks;
  });
}
