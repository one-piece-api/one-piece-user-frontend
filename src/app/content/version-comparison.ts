/**
 * Comparing two versions of a content (UF-CNT-21), whatever its entity: which version a
 * comparison starts from, which others it may start from, and how one field changed between
 * the two. Which fields a version has is the entity's business - see its `diff…` function.
 */
import type { VersionSummary } from './content.model';

/** How a field changed from the base to the version compared. */
export type FieldChange = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

/** The order the changes are counted and listed in. */
export const FIELD_CHANGES: readonly FieldChange[] = ['ADDED', 'REMOVED', 'MODIFIED', 'UNCHANGED'];

/** One field of the comparison: what it said in the base, what it says now, and how it changed. */
export interface FieldDiff<TField> {
  readonly field: TField;
  readonly before: string | null;
  readonly after: string | null;
  readonly change: FieldChange;
}

/**
 * Compares one field: a text with nothing but spaces counts as absent, like `null`. A field
 * absent on both sides is not part of the comparison at all - `null`.
 */
export function diffField<TField>(
  field: TField,
  before: string | null | undefined,
  after: string | null | undefined,
): FieldDiff<TField> | null {
  const was = before?.trim() || null;
  const is = after?.trim() || null;
  if (was === null && is === null) {
    return null;
  }
  return { field, before: was, after: is, change: changeOf(was, is) };
}

function changeOf(before: string | null, after: string | null): FieldChange {
  if (before === null) {
    return 'ADDED';
  }
  if (after === null) {
    return 'REMOVED';
  }
  return before === after ? 'UNCHANGED' : 'MODIFIED';
}

/** How many fields changed in each way - every kind present, zero included. */
export function countChanges(diffs: readonly FieldDiff<unknown>[]): Record<FieldChange, number> {
  const counts: Record<FieldChange, number> = { ADDED: 0, REMOVED: 0, MODIFIED: 0, UNCHANGED: 0 };
  for (const diff of diffs) {
    counts[diff.change]++;
  }
  return counts;
}

/**
 * The versions a version may be compared with: the earlier ones the caller can see, the
 * most recent first.
 */
export function earlierVersions(
  versions: readonly VersionSummary[],
  target: number,
): VersionSummary[] {
  return versions.filter((version) => version.number < target).reverse();
}

/**
 * What a version is compared with by default: the version it was opened from, so the
 * comparison shows exactly what its author changed - `null`, an empty content, for the
 * first one. A base is always a closed version, visible to every reader; should it be
 * missing anyway, the comparison starts from empty rather than from a version it was not
 * opened from.
 */
export function defaultBase(versions: readonly VersionSummary[], target: number): number | null {
  const basedOn = versions.find((version) => version.number === target)?.basedOn ?? null;
  return earlierVersions(versions, target).some((version) => version.number === basedOn)
    ? basedOn
    : null;
}
