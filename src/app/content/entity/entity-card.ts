import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { LanguageEntry } from '../language-catalog';
import { ENTITY, entityOf } from './entities';
import { STATUS_DOT_CLASS, STATUS_SOFT_CLASS } from '../status-badge';
import { isLanguageComplete, localizedFields, sharedFields, type EntityBody } from './entity-body';
import { naturalKeyParts, type PartField, type PartListField } from './entity-definition';
import { EntityImageFrame } from './entity-image-frame';
import { isImageReference } from './entity-image';
import { monthDayLabel, monthDayOf, monthDayText } from './entity-month-day';
import { itemsOf, localizedTextsOf, partValueOf } from './entity-part-list';
import { isReference, referenceLabel } from './entity-reference';
import { countryName, releaseDateLabel, releasesInOrder } from './entity-release';
import {
  STORY_POINT_PARTS,
  STORY_POINT_TARGETS,
  storyItemLabel,
  storyPointOf,
} from './entity-story-point';
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
  /** Its first appearance, "Cap. 1 — Romance Dawn", a chapter and an episode; none for none. */
  readonly firstAppearance: readonly StoryItemLink[];
}

/** A chapter or an episode of a first appearance: "Cap. 1 — Romance Dawn", and its page. */
interface StoryItemLink {
  readonly label: string;
  /** Empty for a content whose section this app does not have. */
  readonly link: readonly string[];
}

/**
 * One part of an entry of a list, in the language shown: its words - `null` for a localized
 * text not written there - and, for a content pointed to, a link to its page.
 */
interface PartView {
  readonly key: string;
  readonly text: string | null;
  readonly link: readonly string[];
}

/** An entry of a list of parts: its parts with something in them, in the definition's order. */
interface PartEntryView {
  readonly position: number;
  readonly parts: readonly PartView[];
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
  /** A first appearance in both media: the episode, shown under the chapter. */
  readonly also?: StoryItemLink;
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
  /**
   * Its name in the language shown - or, for an entity without a localized name, what its
   * definition calls it (a bounty: "Monkey D. Luffy — 3.000.000.000 ฿").
   */
  protected readonly name = computed(() => {
    const { labelField, label } = this.entity;
    if (labelField) {
      return textOf(this.translation()?.[labelField]).trim() || null;
    }
    return label?.(this.body(), this.transloco.activeLang()) ?? null;
  });
  /** What the card says where the language has no name: `content.card.noName`, `noTitle`. */
  protected readonly noNameKey = this.entity.labelField
    ? `content.card.no${this.entity.labelField[0].toUpperCase()}${this.entity.labelField.slice(1)}`
    : 'content.list.unnamed';
  /** Whether the natural key goes under the name: not where the name is made of it. */
  protected readonly showsNaturalKey = !this.entity.label;
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
        const [first, also] = this.storyItemLinks(this.body()[field.key], language);
        return [
          {
            field: field.key,
            headingKey: `content.card.heading.${field.key}`,
            emptyKey: `content.card.no${name}`,
            label: first?.label ?? null,
            link: first?.link ?? [],
            ...(also ? { also } : {}),
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
          label: isReference(reference) ? referenceLabel(reference, language, target) : null,
          link: isReference(reference) && target ? [target.route, reference.id] : [],
        },
      ];
    });
  });

  /**
   * The values the backend works out (a bounty's validity), each a pill beside the name in
   * the colors of its tone; none where the version has no such value.
   */
  protected readonly badges = computed(() => {
    this.transloco.activeLang();
    return this.entity.fields.flatMap((field) => {
      const value = this.body()[field.key];
      if (field.kind !== 'badge' || typeof value !== 'string' || !field.tones[value]) {
        return [];
      }
      const tone = field.tones[value];
      return [
        {
          field: field.key,
          label: this.transloco.translate(`${this.entity.i18n}.options.${field.key}.${value}`),
          classes: STATUS_SOFT_CLASS[tone],
          dotClass: STATUS_DOT_CLASS[tone],
        },
      ];
    });
  });

  /**
   * The texts, numbers, choices and yes-or-no values besides the natural key that the version
   * filled in, in the order of the definition - a choice by its label, a yes or no in words.
   */
  protected readonly facts = computed<Fact[]>(() => {
    this.transloco.activeLang();
    const keyParts = naturalKeyParts(this.entity);
    return sharedFields(this.entity).flatMap((field) => {
      const value = this.body()[field.key];
      if (field.kind === 'choice' && typeof value === 'string' && value) {
        const label = this.transloco.translate(`${this.entity.i18n}.options.${field.key}.${value}`);
        return [{ field: field.key, value: label, lang: null }];
      }
      if (field.kind === 'monthDay') {
        const day = monthDayText(monthDayOf(value));
        return day
          ? [
              {
                field: field.key,
                value: monthDayLabel(day, this.transloco.activeLang()),
                lang: null,
              },
            ]
          : [];
      }
      if (field.kind === 'boolean') {
        if (field.inCard === false) {
          return [];
        }
        const label = this.transloco.translate(
          value === true ? 'content.card.yes' : 'content.card.no',
        );
        return [{ field: field.key, value: label, lang: null }];
      }
      if ((field.kind !== 'text' && field.kind !== 'number') || keyParts.includes(field.key)) {
        return [];
      }
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
    });
  });

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

  /** The chapter and the episode a first appearance names, in that order, as the card links them. */
  private storyItemLinks(value: unknown, language: string): StoryItemLink[] {
    const point = storyPointOf(value);
    return STORY_POINT_PARTS.flatMap((part) => {
      const item = point[part];
      const route = entityOf(STORY_POINT_TARGETS[part])?.route;
      return item
        ? [
            {
              label: storyItemLabel(
                (key, params) => this.transloco.translate(key, params),
                part,
                item,
                language,
              ),
              link: route ? [route, item.id] : [],
            },
          ]
        : [];
    });
  }

  /** The lists of subcategories the content defines, in their order, each a section. */
  protected readonly subcategoryLists = computed(() => {
    const language = this.language() ?? '';
    this.transloco.activeLang();
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
                  firstAppearance: this.storyItemLinks(subcategory.firstAppearance, language),
                }),
              ),
            },
          ]
        : [],
    );
  });

  /**
   * The lists of parts - epithets, aliases, species - a section each, the entries in their
   * order and each part in the language shown; an empty list shows nothing.
   */
  protected readonly partLists = computed(() => {
    const language = this.language() ?? this.transloco.activeLang();
    this.transloco.activeLang();
    return this.entity.fields.flatMap((field) =>
      field.kind === 'partList'
        ? [
            {
              field: field.key,
              entries: itemsOf(this.body()[field.key]).map<PartEntryView>((item, index) => ({
                position: index + 1,
                parts: field.parts.flatMap((part) => this.partView(field, part, item, language)),
              })),
            },
          ]
        : [],
    );
  });

  /**
   * One part of an entry as the card shows it: a content pointed to by its name and linked, a
   * localized text in the language shown - `null` when not written there - a choice by its
   * label, a yes by the label of the part in its list; nothing for an empty part or a no.
   */
  private partView(
    field: PartListField,
    part: PartField,
    item: unknown,
    language: string,
  ): PartView[] {
    const value = partValueOf(field, item, part);
    const view = (text: string | null, link: readonly string[] = []) => [
      { key: part.key, text, link },
    ];
    switch (part.kind) {
      case 'relation': {
        const target = entityOf(part.target);
        return isReference(value)
          ? view(referenceLabel(value, language, target), target ? [target.route, value.id] : [])
          : [];
      }
      case 'localizedText':
        return view(localizedTextsOf(value)[language]?.trim() || null);
      case 'choice':
        return typeof value === 'string' && value
          ? view(this.transloco.translate(`${this.entity.i18n}.options.${part.key}.${value}`))
          : [];
      case 'boolean':
        return value === true
          ? view(
              this.transloco.translate(`${this.entity.i18n}.options.${field.key}.${part.key}.true`),
            )
          : [];
      case 'text':
        return textOf(value).trim() ? view(textOf(value).trim()) : [];
    }
  }

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
