/**
 * What each kind of field knows about its own value - pattern Strategy: the generic
 * functions of `entity-body.ts` walk the fields of a definition and leave every value to its
 * kind. Where a value lives - on the version, or in the translation of one language - is
 * the kind's `localized`. A new kind is added here, and drawn in the card, the editor and
 * the comparison.
 */
import { diffField, type FieldDiff } from '../version-comparison';
import type { EntityField, FieldKindName } from './entity-definition';
import { isImageDraft, isImageReference } from './entity-image';
import { isReference, type EntityReference } from './entity-reference';
import { newReleaseKey, releasesOf, type ReleaseDraft } from './entity-release';
import {
  comparedStoryPoint,
  isStoryPointFilled,
  storyPointOf,
  type StoryPointDraft,
} from './entity-story-point';
import {
  SUBCATEGORY_PARTS,
  isSubcategoryReference,
  newSubcategoryKey,
  subcategoriesOf,
  subcategoryText,
  type SubcategoryDraft,
} from './entity-subcategory';

export interface FieldKind {
  /** Written once per language, inside `translations`, rather than once on the version. */
  readonly localized: boolean;
  /** Asked for by review: an empty value keeps the draft from being ready. */
  readonly forReview: boolean;
  /** What the editor holds for a value of a version - `undefined` for a content not saved yet. */
  draftValue(saved: unknown): unknown;
  /** What the editor's value is saved as in the JSON - `undefined` for one sent otherwise. */
  savedValue(draft: unknown): unknown;
  /** Whether a value - saved, or being written - counts as filled in for review. */
  isFilled(value: unknown): boolean;
  /** How the value changed from `before` to `after`; `null` when it is absent on both sides. */
  diff<TField>(field: TField, before: unknown, after: unknown): FieldDiff<TField> | null;
}

/** A text value as the screens show and edit it: never `null`. */
export function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** A text: no space around it when saved, `null` where nothing was written. */
const TEXT_VALUE = {
  draftValue: textOf,
  savedValue: (draft: unknown) => textOf(draft).trim() || null,
  isFilled: (value: unknown) => !!textOf(value).trim(),
  diff: <TField>(field: TField, before: unknown, after: unknown) =>
    diffField(field, textOf(before), textOf(after)),
};

/** A whole number >= 0 as typed in the editor: only digits, so no sign, decimals or text. */
const DIGITS = /^\d+$/;

/**
 * An integer >= 0 shared by every language, such as a chapter number: the editor holds the
 * string typed, the JSON a number - `null` where nothing valid was written, so the backend
 * refuses what the browser let through. A comparison looks at the written forms.
 */
const NUMBER_VALUE = {
  draftValue: (saved: unknown) => (typeof saved === 'number' ? String(saved) : ''),
  savedValue: (draft: unknown) => {
    const written = textOf(draft).trim();
    return DIGITS.test(written) ? Number(written) : null;
  },
  isFilled: (value: unknown) =>
    typeof value === 'number'
      ? Number.isInteger(value) && value >= 0
      : DIGITS.test(textOf(value).trim()),
  diff: <TField>(field: TField, before: unknown, after: unknown) =>
    diffField(field, numberText(before), numberText(after)),
};

/** A number as compared: its digits; `''` where there is none. */
function numberText(value: unknown): string {
  return typeof value === 'number' ? String(value) : textOf(value);
}

/** The id of a reference, `null` for a value that points nowhere. */
function idOf(value: unknown): string | null {
  return isReference(value) ? value.id : null;
}

/**
 * What a reference is called in a comparison, not tied to a language: a numbered one is
 * "12 · Name" with the first name it has, else its number; otherwise the romaji, else the id.
 */
function comparedLabel(value: unknown): string | null {
  if (!isReference(value)) {
    return null;
  }
  if (typeof value.number === 'number') {
    const name = Object.values(value.names).find(Boolean);
    return name ? `${value.number} · ${name}` : String(value.number);
  }
  return value.romaji || value.id;
}

/**
 * A pointer to another content. The API shows the content pointed to as it is today
 * (`EntityReference`) and is given only its id: the editor holds the reference whole, so the
 * choice is named at once, and this is where it becomes an id when saved - Adapter between
 * the two shapes. A comparison looks at the ids: a content that was only renamed is still the
 * same one.
 */
const RELATION_VALUE = {
  draftValue: (saved: unknown): EntityReference | null => (isReference(saved) ? saved : null),
  savedValue: idOf,
  isFilled: isReference,
  diff: <TField>(field: TField, before: unknown, after: unknown) => {
    const diff = diffField(field, idOf(before), idOf(after));
    return diff && { ...diff, before: comparedLabel(before), after: comparedLabel(after) };
  },
};

/** The id of a saved image, `null` where there is none. */
function imageIdOf(value: unknown): string | null {
  return isImageReference(value) ? value.id : null;
}

/**
 * An image: the editor holds the one saved or a file just chosen (`ImageDraft`). It is not
 * part of the JSON - the file travels beside it, and removing it is a flag (`uploadOf` in
 * `entity-body.ts`). A comparison looks at the ids, the hashes of the bytes: an image sent
 * again is still the same one; what it shows is each side's URL.
 */
const IMAGE_VALUE = {
  draftValue: (saved: unknown) => (isImageReference(saved) ? { saved } : null),
  savedValue: () => undefined,
  isFilled: isImageDraft,
  diff: <TField>(field: TField, before: unknown, after: unknown) => {
    const diff = diffField(field, imageIdOf(before), imageIdOf(after));
    return (
      diff && {
        ...diff,
        before: isImageReference(before) ? before.url : null,
        after: isImageReference(after) ? after.url : null,
      }
    );
  },
};

/**
 * A first appearance: the editor holds the chapter's and the episode's references whole, as
 * for a relation, and the JSON sends `{ chapter: id, episode: id }` - `null` for a part not
 * chosen, `null` as a whole where neither is. Filled with either part. A comparison looks at
 * both ids and carries each part's number and title (`comparedStoryPoint`).
 */
const STORY_POINT_VALUE = {
  draftValue: storyPointOf,
  savedValue: (draft: unknown) => {
    const { chapter, episode } = storyPointOf(draft);
    return chapter || episode
      ? { chapter: chapter?.id ?? null, episode: episode?.id ?? null }
      : null;
  },
  isFilled: isStoryPointFilled,
  diff: <TField>(field: TField, before: unknown, after: unknown) => {
    const idsOf = ({ chapter, episode }: StoryPointDraft) =>
      chapter || episode ? `${chapter?.id ?? ''}|${episode?.id ?? ''}` : null;
    const diff = diffField(field, idsOf(storyPointOf(before)), idsOf(storyPointOf(after)));
    return (
      diff && { ...diff, before: comparedStoryPoint(before), after: comparedStoryPoint(after) }
    );
  },
};

/**
 * The subcategories a content defines: the editor holds each with a key of its own, the JSON
 * sends each with its id - left out for one just added, the backend gives it - and its texts,
 * trimmed, `null` where nothing was written. Not a value review asks for as a whole: each name
 * and description is a check of its own (`subcategoryChecks`), and each is compared on its
 * own (`diffSubcategories`).
 */
const SUBCATEGORY_LIST_VALUE = {
  draftValue: (saved: unknown): SubcategoryDraft[] =>
    subcategoriesOf(saved).map(({ id, translations, firstAppearance }) => ({
      id,
      key: newSubcategoryKey(),
      firstAppearance,
      translations: Object.fromEntries(
        Object.entries(translations).map(([language, texts]) => [
          language,
          { name: textOf(texts?.name), description: textOf(texts?.description) },
        ]),
      ),
    })),
  savedValue: (draft: unknown) =>
    (Array.isArray(draft) ? (draft as SubcategoryDraft[]) : []).map((subcategory) => ({
      ...(subcategory.id ? { id: subcategory.id } : {}),
      firstAppearance: STORY_POINT_VALUE.savedValue(subcategory.firstAppearance),
      translations: Object.fromEntries(
        Object.keys(subcategory.translations).map((language) => [
          language,
          Object.fromEntries(
            SUBCATEGORY_PARTS.map((part) => [
              part,
              subcategoryText(subcategory, language, part).trim() || null,
            ]),
          ),
        ]),
      ),
    })),
  isFilled: () => true,
  diff: () => null,
};

/** What a subcategory picked is called in a comparison, not tied to a language: every name. */
function subcategoryComparedLabel(value: unknown): string | null {
  if (!isSubcategoryReference(value)) {
    return null;
  }
  return [...new Set(Object.values(value.names).filter(Boolean))].join(' / ') || value.id;
}

/**
 * One subcategory picked among those of the content a relation points to: held whole by the
 * editor, so it is named at once, saved as its id - the same Adapter as a relation. A
 * comparison looks at the ids: a subcategory renamed is still the same one.
 */
const SUBCATEGORY_VALUE = {
  draftValue: (saved: unknown) => (isSubcategoryReference(saved) ? saved : null),
  savedValue: (draft: unknown) => (isSubcategoryReference(draft) ? draft.id : null),
  isFilled: isSubcategoryReference,
  diff: <TField>(field: TField, before: unknown, after: unknown) => {
    const idOfPicked = (value: unknown) => (isSubcategoryReference(value) ? value.id : null);
    const diff = diffField(field, idOfPicked(before), idOfPicked(after));
    return (
      diff && {
        ...diff,
        before: subcategoryComparedLabel(before),
        after: subcategoryComparedLabel(after),
      }
    );
  },
};

/** A release as a comparison and a sorted list write it: `JP 1997-10-20`. */
function releaseText({ country, date }: { country: string; date: string }): string {
  return `${country} ${date}`;
}

/** The releases with both a country and a date, by date then country. */
function completeReleases<TRelease extends { country: string; date: string }>(
  releases: readonly TRelease[],
): TRelease[] {
  return releases
    .filter(({ country, date }) => country && date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.country.localeCompare(b.country));
}

/**
 * The rows of the editor the way the JSON lists them - only the complete ones, in date
 * order - so an error the backend names by position (`releases[1].date`) finds its row.
 */
export function sentReleaseRows(draft: unknown): ReleaseDraft[] {
  return completeReleases(Array.isArray(draft) ? (draft as ReleaseDraft[]) : []);
}

/**
 * The `{country, date}` list of a volume's releases or an episode's broadcasts: the editor
 * holds each entry with a key of its own, the JSON sends the complete ones - always a list,
 * `[]` where there is none - sorted by date then country. Optional, so never asked for by
 * review; a comparison shows one text, an entry per line.
 */
const RELEASE_LIST_VALUE = {
  draftValue: (saved: unknown): ReleaseDraft[] =>
    releasesOf(saved).map(({ country, date }) => ({ key: newReleaseKey(), country, date })),
  savedValue: (draft: unknown) =>
    sentReleaseRows(draft).map(({ country, date }) => ({ country, date })),
  isFilled: (value: unknown) => sentReleaseRows(value).length > 0,
  diff: <TField>(field: TField, before: unknown, after: unknown) => {
    const written = (value: unknown) =>
      completeReleases(releasesOf(value)).map(releaseText).join('\n');
    return diffField(field, written(before), written(after));
  },
};

/**
 * Whether review asks for a field: its kind is one review looks at, and the definition did
 * not mark it `optional` - an optional one is never "missing".
 */
export function isAskedByReview(field: EntityField): boolean {
  return FIELD_KINDS[field.kind].forReview && !('optional' in field && field.optional);
}

export const FIELD_KINDS: Record<FieldKindName, FieldKind> = {
  text: { localized: false, forReview: true, ...TEXT_VALUE },
  number: { localized: false, forReview: true, ...NUMBER_VALUE },
  localizedText: { localized: true, forReview: true, ...TEXT_VALUE },
  relation: { localized: false, forReview: true, ...RELATION_VALUE },
  image: { localized: false, forReview: false, ...IMAGE_VALUE },
  subcategoryList: { localized: false, forReview: false, ...SUBCATEGORY_LIST_VALUE },
  subcategory: { localized: false, forReview: false, ...SUBCATEGORY_VALUE },
  releaseList: { localized: false, forReview: false, ...RELEASE_LIST_VALUE },
  storyPoint: { localized: false, forReview: true, ...STORY_POINT_VALUE },
};
