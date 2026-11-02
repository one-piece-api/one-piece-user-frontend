/**
 * The gallery of a version (workflow 3.5.1, reveals plan R8): which entry is the main portrait,
 * read without a filter. No Angular in here.
 */
import type { EntryCondition, ImageField, PartListField } from './entity-definition';
import { ENDED_PART, partValueOf } from './entity-part-list';
import { isStoryPointFilled } from './entity-story-point';
import { textOf } from './field-kinds';

/** Whether an entry meets a condition on one of its choice parts: an appearance. */
export function meetsCondition(
  field: PartListField,
  item: unknown,
  condition: EntryCondition,
): boolean {
  const part = field.parts.find(({ key }) => key === condition.part);
  return part !== undefined && textOf(partValueOf(field, item, part)) === condition.equals;
}

/**
 * The position of the main portrait without a filter - mirror of the library rule
 * `Gallery.mainPortrait` (one-piece-reader-time), kept equal by the same cases in the tests:
 * the last appearance without an end, in list order; else the last appearance. `null` for a
 * list that is no gallery or has no appearance. The rule at a reader position stays in the
 * backend (preview at N).
 */
export function mainPortraitIndex(field: PartListField, items: readonly unknown[]): number | null {
  const condition = field.mainPortrait;
  if (!condition) {
    return null;
  }
  const appearances = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => meetsCondition(field, item, condition));
  const current = appearances.filter(
    ({ item }) => !isStoryPointFilled(partValueOf(field, item, ENDED_PART)),
  );
  return (current.at(-1) ?? appearances.at(-1))?.index ?? null;
}

/** The image part of a list's entries, where the list has one: a gallery's. */
export function imagePartOf(field: PartListField): ImageField | null {
  return field.parts.find((part): part is ImageField => part.kind === 'image') ?? null;
}
