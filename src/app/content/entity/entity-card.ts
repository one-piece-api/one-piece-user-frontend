import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { LanguageEntry } from '../language-catalog';
import { ENTITY, entityOf } from './entities';
import {
  isTranslationComplete,
  localizedFields,
  sharedFields,
  type EntityBody,
} from './entity-body';
import { EntityImageFrame } from './entity-image-frame';
import { isImageReference } from './entity-image';
import { isReference, referenceLabel } from './entity-reference';
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

/** A content this one points to, as the card shows it: a link to its page under a heading. */
interface RelationChip {
  readonly field: string;
  /** `content.card.heading.type`, `content.card.noType`: the heading, and what stands in for none. */
  readonly headingKey: string;
  readonly emptyKey: string;
  /** `null` when none is chosen. */
  readonly label: string | null;
  /** Where the link leads - empty for a content whose section this app does not have. */
  readonly link: readonly string[];
}

/**
 * The card of a version of any entity: its image on the left when the entity has one, then its
 * name and the language tabs, the contents it points to, and its long texts one section each,
 * one language at a time. The tabs are the language catalog; a dot marks a language whose
 * translation is incomplete. What the page projects (`[cardSide]`) becomes a column on the
 * right - the fruits of a type.
 */
@Component({
  selector: 'app-entity-card',
  templateUrl: './entity-card.html',
  imports: [EntityImageFrame, RouterLink, TranslocoPipe],
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
  protected readonly romaji = computed(() => textOf(this.body().romaji).trim() || null);

  /**
   * The image of the version, for an entity that has one: its URL - `null` for none - named
   * in the language shown, else by its romaji, and the placeholder saying whose it would be.
   */
  protected readonly image = computed(() => {
    const field = this.entity.fields.find(({ kind }) => kind === 'image');
    if (!field) {
      return null;
    }
    this.transloco.activeLang();
    const saved = this.body()[field.key];
    const named = this.name() ?? this.romaji() ?? '';
    return {
      src: isImageReference(saved) ? saved.url : null,
      alt: named,
      placeholder: this.transloco.translate('content.card.imageOf', {
        name: named || this.transloco.translate('content.card.thisContent'),
      }),
    };
  });

  /** The contents this one points to, named in the language shown. */
  protected readonly relations = computed<RelationChip[]>(() => {
    const language = this.language() ?? this.transloco.activeLang();
    return sharedFields(this.entity).flatMap((field) => {
      if (field.kind !== 'relation') {
        return [];
      }
      const reference = this.body()[field.key];
      const target = entityOf(field.target);
      const name = `${field.key[0].toUpperCase()}${field.key.slice(1)}`;
      return [
        {
          field: field.key,
          headingKey: `content.card.heading.${field.key}`,
          emptyKey: `content.card.no${name}`,
          label: isReference(reference) ? referenceLabel(reference, language) : null,
          link: isReference(reference) && target ? [target.route, reference.id] : [],
        },
      ];
    });
  });

  /** The long texts in reading order, each a section of the card. */
  protected readonly longTexts = computed<LongText[]>(() =>
    localizedFields(this.entity).flatMap((field) =>
      field.kind === 'localizedText' && field.rows
        ? [
            {
              field: field.key,
              text: textOf(this.translation()?.[field.key]).trim() || null,
              emptyKey: `content.card.no${field.key[0].toUpperCase()}${field.key.slice(1)}`,
            },
          ]
        : [],
    ),
  );
}
