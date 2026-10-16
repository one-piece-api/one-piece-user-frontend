import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { LanguageEntry } from '../language-catalog';
import { ENTITY, entityOf } from './entities';
import { isLanguageComplete, localizedFields, sharedFields, type EntityBody } from './entity-body';
import { EntityImageFrame } from './entity-image-frame';
import { isImageReference } from './entity-image';
import { isReference, referenceLabel } from './entity-reference';
import { countryName, releaseDateLabel, releasesInOrder } from './entity-release';
import { STORY_POINT_TARGET, chapterLabel, chapterOf } from './entity-story-point';
import { worldDateOf, worldDateText, yearsBeforeStory, type WorldDate } from './entity-event-time';
import { untitledOf } from './entity-title';
import {
  isSubcategoryReference,
  subcategoriesOf,
  subcategoryLabel,
  subcategoryText,
} from './entity-subcategory';
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

/** A text or a number of the content that is not its natural key: japanese title, page count. */
interface Fact {
  readonly field: string;
  readonly value: string;
  /** The language it is written in, where it is not the interface's own. */
  readonly lang: string | null;
}

/** One release or broadcast of the card: the country and the day, in the interface's language. */
interface ReleaseEntry {
  readonly country: string;
  readonly date: string;
}

/** A subcategory the content defines, in the language shown; a text is null when not written. */
interface SubcategoryEntry {
  readonly id: string;
  readonly name: string | null;
  readonly description: string | null;
  /** Its first appearance, "Cap. 1 — Romance Dawn", and the chapter's page; `null` for none. */
  readonly firstAppearance: { readonly label: string; readonly link: readonly string[] } | null;
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
  /** A story point: the episode beside the chapter is not built yet, "coming soon". */
  readonly episodeSoon?: true;
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
      incomplete: !isLanguageComplete(this.entity, this.body(), code),
    })),
  );

  protected readonly languageLabel = computed(() => this.language()?.toUpperCase() ?? '');

  private readonly translation = computed(() => this.body().translations[this.language() ?? '']);
  protected readonly name = computed(
    () => textOf(this.translation()?.[this.entity.labelField]).trim() || null,
  );
  /** What the card says where the language has no name: `content.card.noName`, `noTitle`. */
  protected readonly noNameKey = `content.card.no${this.entity.labelField[0].toUpperCase()}${this.entity.labelField.slice(1)}`;
  /** Whether the entity has one: an event is told apart by its id alone. */
  protected readonly hasNaturalKey = this.entity.naturalKey !== undefined;
  /** The natural key: the romaji, or "Chapter 12" for a numbered content. */
  protected readonly naturalKey = computed(() => {
    this.transloco.activeLang();
    return (untitledOf(this.transloco, this.entity, this.body()) ?? '').trim() || null;
  });

  /**
   * The image of the version, for an entity that has one: its URL - `null` for none - named
   * in the language shown, else by its natural key, and the placeholder saying whose it would be.
   */
  protected readonly image = computed(() => {
    const field = this.entity.fields.find((candidate) => candidate.kind === 'image');
    if (field?.kind !== 'image') {
      return null;
    }
    this.transloco.activeLang();
    const saved = this.body()[field.key];
    const named = this.name() ?? this.naturalKey() ?? '';
    return {
      src: isImageReference(saved) ? saved.url : null,
      ratio: field.profile.width / field.profile.height,
      alt: named,
      placeholder: this.transloco.translate('content.card.imageOf', {
        name: named || this.transloco.translate('content.card.thisContent'),
      }),
    };
  });

  /**
   * The contents this one points to, named in the language shown - a story point by its
   * chapter, "Cap. 1 — Romance Dawn".
   */
  protected readonly relations = computed<RelationChip[]>(() => {
    const language = this.language() ?? this.transloco.activeLang();
    this.transloco.activeLang();
    return sharedFields(this.entity).flatMap<RelationChip>((field) => {
      const name = `${field.key[0].toUpperCase()}${field.key.slice(1)}`;
      if (field.kind === 'storyPoint') {
        const chapter = chapterOf(this.body()[field.key]);
        const target = entityOf(STORY_POINT_TARGET);
        return [
          {
            field: field.key,
            headingKey: `content.card.heading.${field.key}`,
            emptyKey: `content.card.no${name}`,
            label:
              chapter &&
              chapterLabel(
                (key, params) => this.transloco.translate(key, params),
                chapter,
                language,
              ),
            link: chapter && target ? [target.route, chapter.id] : [],
            episodeSoon: true,
          },
        ];
      }
      if (field.kind === 'eventTime') {
        const value = this.body()[field.key];
        const chapter = chapterOf(value);
        const date = worldDateOf(value);
        const target = entityOf(STORY_POINT_TARGET);
        return [
          {
            field: field.key,
            headingKey: `content.card.heading.${field.key}`,
            emptyKey: `content.card.no${name}`,
            label: chapter
              ? chapterLabel(
                  (key, params) => this.transloco.translate(key, params),
                  chapter,
                  language,
                )
              : date && this.worldDateLabel(date),
            link: chapter && target ? [target.route, chapter.id] : [],
          },
        ];
      }
      if (field.kind !== 'relation') {
        return [];
      }
      const reference = this.body()[field.key];
      const target = entityOf(field.target);
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

  /** A world date with how long before the story it is: "c. 1500 · 22 years before the story begins". */
  private worldDateLabel(date: WorldDate): string {
    const years = yearsBeforeStory(date);
    const before =
      years &&
      this.transloco.translate(
        `content.eventTime.${date.approximate ? 'yearsBeforeApproximate' : 'yearsBefore'}`,
        { years },
      );
    return before ? `${worldDateText(date)} · ${before}` : worldDateText(date);
  }

  /** The texts and numbers besides the natural key that the version filled in, in the order of the definition. */
  protected readonly facts = computed<Fact[]>(() =>
    sharedFields(this.entity).flatMap((field) => {
      if (
        (field.kind !== 'text' && field.kind !== 'number') ||
        field.key === this.entity.naturalKey
      ) {
        return [];
      }
      const value = this.body()[field.key];
      const written = (typeof value === 'number' ? String(value) : textOf(value)).trim();
      return written
        ? [
            {
              field: field.key,
              value: written,
              lang: field.kind === 'text' ? (field.lang ?? null) : null,
            },
          ]
        : [];
    }),
  );

  /** The releases or broadcasts, a section each, by day: the country named in the interface's language. */
  protected readonly releaseLists = computed(() => {
    const language = this.transloco.activeLang();
    return this.entity.fields.flatMap((field) =>
      field.kind === 'releaseList'
        ? [
            {
              field: field.key,
              entries: releasesInOrder(this.body()[field.key]).map<ReleaseEntry>(
                ({ country, date }) => ({
                  country: countryName(country, language),
                  date: releaseDateLabel(date, language),
                }),
              ),
            },
          ]
        : [],
    );
  });

  /**
   * The subcategory picked, beside the content it belongs to - only when there is one: most
   * contents have none.
   */
  protected readonly subcategories = computed<RelationChip[]>(() => {
    const language = this.language() ?? this.transloco.activeLang();
    return sharedFields(this.entity).flatMap<RelationChip>((field) => {
      const picked = this.body()[field.key];
      return field.kind === 'subcategory' && isSubcategoryReference(picked)
        ? [
            {
              field: field.key,
              headingKey: `content.card.heading.${field.key}`,
              emptyKey: '',
              label: subcategoryLabel(picked, language),
              link: [],
            },
          ]
        : [];
    });
  });

  /** The lists of subcategories the content defines, in their order, each a section. */
  protected readonly subcategoryLists = computed(() => {
    const language = this.language() ?? '';
    this.transloco.activeLang();
    const chapterRoute = entityOf(STORY_POINT_TARGET)?.route;
    return this.entity.fields.flatMap((field) =>
      field.kind === 'subcategoryList'
        ? [
            {
              field: field.key,
              entries: subcategoriesOf(this.body()[field.key]).map<SubcategoryEntry>(
                (subcategory) => ({
                  id: subcategory.id,
                  name: subcategoryText(subcategory, language, 'name').trim() || null,
                  description: subcategoryText(subcategory, language, 'description').trim() || null,
                  firstAppearance: subcategory.firstAppearance && {
                    label: chapterLabel(
                      (key, params) => this.transloco.translate(key, params),
                      subcategory.firstAppearance,
                      language,
                    ),
                    link: chapterRoute ? [chapterRoute, subcategory.firstAppearance.id] : [],
                  },
                }),
              ),
            },
          ]
        : [],
    );
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
