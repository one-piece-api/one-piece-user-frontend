/**
 * What each kind of field knows about its own value - pattern Strategy: the generic
 * functions of `entity-body.ts` walk the fields of a definition and leave every value to its
 * kind. Where a value lives - on the version, or in the translation of one language - is
 * the kind's `localized`. A new kind is added here, and drawn in the card, the editor and
 * the comparison.
 */
import { diffField, type FieldDiff } from '../version-comparison';
import type { FieldKindName } from './entity-definition';
import { isReference, type EntityReference } from './entity-reference';

export interface FieldKind {
  /** Written once per language, inside `translations`, rather than once on the version. */
  readonly localized: boolean;
  /** What the editor holds for a value of a version - `undefined` for a content not saved yet. */
  draftValue(saved: unknown): unknown;
  /** What the editor's value is saved as. */
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

export const FIELD_KINDS: Record<FieldKindName, FieldKind> = {
  text: { localized: false, ...TEXT_VALUE },
  localizedText: { localized: true, ...TEXT_VALUE },
  relation: { localized: false, ...RELATION_VALUE },
};
