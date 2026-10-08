/**
 * What each kind of field knows about its own value - pattern Strategy: the generic
 * functions of `entity-body.ts` walk the fields of a definition and leave every value to its
 * kind. Where a value lives - on the version, or in the translation of one language - is
 * the kind's `localized`. A new kind is added here, and drawn in the card, the editor and
 * the comparison.
 */
import { diffField, type FieldDiff } from '../version-comparison';
import type { FieldKindName } from './entity-definition';
import { isImageDraft, isImageReference } from './entity-image';
import { isReference, type EntityReference } from './entity-reference';

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

/** The id of a reference, `null` for a value that points nowhere. */
function idOf(value: unknown): string | null {
  return isReference(value) ? value.id : null;
}

/** What a reference is called in a comparison, which is not tied to a language: romaji, else id. */
function comparedLabel(value: unknown): string | null {
  return isReference(value) ? value.romaji || value.id : null;
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

export const FIELD_KINDS: Record<FieldKindName, FieldKind> = {
  text: { localized: false, forReview: true, ...TEXT_VALUE },
  localizedText: { localized: true, forReview: true, ...TEXT_VALUE },
  relation: { localized: false, forReview: true, ...RELATION_VALUE },
  image: { localized: false, forReview: false, ...IMAGE_VALUE },
};
