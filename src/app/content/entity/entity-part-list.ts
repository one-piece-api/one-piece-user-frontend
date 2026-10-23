/**
 * The entries of a `partList` field - a character's epithets, aliases, species - as the API
 * sends them and as the editor holds them: where each part's value is in an entry, what
 * identifies an entry, and where the backend says one is at fault. How each value is read,
 * saved and compared is its part's kind (`field-kinds.ts`). No Angular in here.
 */
import type { ChoiceField, PartField, PartListField } from './entity-definition';
import { isReference } from './entity-reference';

/**
 * An entry while it is written: `key` tells the rows apart on screen - the backend gives an
 * entry no id - and `values` holds each part's value as its kind's editor does, a localized
 * part as a map of language to text.
 */
export interface PartEntryDraft {
  readonly key: string;
  readonly values: Readonly<Record<string, unknown>>;
}

let nextKey = 0;

/** A key for an entry of the editor, unique while the page lives. */
export function newPartEntryKey(): string {
  return `part-${nextKey++}`;
}

/**
 * Whether the list travels as bare values - `["Sogeking"]`, `[id]` - rather than as one
 * object per entry: a list of a single part that is not localized.
 */
export function isBareList(field: PartListField): boolean {
  return field.parts.length === 1 && field.parts[0].kind !== 'localizedText';
}

/** Whether a value is an entry of the editor rather than one read from the API. */
export function isPartEntryDraft(value: unknown): value is PartEntryDraft {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string' &&
    typeof (value as { values?: unknown }).values === 'object' &&
    (value as { values?: unknown }).values !== null
  );
}

/** The entries of a value, saved or being written, in order; none for anything else. */
export function itemsOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The value of one part of an entry - read from the API, or being written: the entry itself
 * in a bare list, else its property named after the part.
 */
export function partValueOf(field: PartListField, item: unknown, part: PartField): unknown {
  if (isPartEntryDraft(item)) {
    return item.values[part.key];
  }
  if (isBareList(field)) {
    return item;
  }
  return typeof item === 'object' && item !== null
    ? (item as Record<string, unknown>)[part.key]
    : undefined;
}

/** The texts of a localized part by language - only the texts, whatever else the value holds. */
export function localizedTextsOf(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/** The part no two entries may share, when the list has one. */
export function uniquePart(field: PartListField): PartField | null {
  return field.parts.find(({ key }) => key === field.unique) ?? null;
}

/**
 * What identifies an entry by its unique part, compared as the backend compares it: the id
 * of a content pointed to, a text without the space around it whatever its case; `null`
 * where the list has no unique part or the entry has no value there.
 */
export function identityOf(field: PartListField, item: unknown): string | null {
  const part = uniquePart(field);
  if (!part) {
    return null;
  }
  const value = partValueOf(field, item, part);
  if (part.kind === 'relation') {
    return isReference(value) ? value.id : null;
  }
  return typeof value === 'string' ? value.trim().toLowerCase() || null : null;
}

/**
 * Where the backend says an entry is at fault, as the editor addresses it: `species[1]` is
 * `species.1`, `affiliations[0].marineRank` is `affiliations.0.marineRank`, and
 * `epithets[1].text[en]` is `epithets.1.text.en` - every position the one in the JSON sent.
 * `null` for a path that names no entry of these lists.
 */
export function partListFieldKey(lists: readonly PartListField[], path: string): string | null {
  const match = /^(\w+)\[(\d+)\](?:\.(\w+)(?:\[([^\]]+)\])?)?$/.exec(path);
  const list = lists.find(({ key }) => key === match?.[1]);
  if (!match || !list) {
    return null;
  }
  const [, key, index, part, language] = match;
  if (part && !list.parts.some((candidate) => candidate.key === part)) {
    return null;
  }
  return [key, index, part, language].filter(Boolean).join('.');
}

/**
 * The key of the label a choice of an entry has on the card: `<i18n>.<group>.<VALUE>.<FIELD
 * VALUE>` where the choice is worded after the content chosen in another part (`labelBy`) and
 * that content has the value, else the neutral `<i18n>.options.<part>.<VALUE>`.
 */
export function choiceLabelKey(
  i18n: string,
  list: PartListField,
  part: ChoiceField,
  value: string,
  item: unknown,
): string {
  const neutral = `${i18n}.options.${part.key}.${value}`;
  const by = part.labelBy;
  const source = by ? list.parts.find(({ key }) => key === by.part) : undefined;
  const chosen = by && source ? partValueOf(list, item, source) : undefined;
  const word = by && isReference(chosen) ? chosen[by.field] : undefined;
  return by && typeof word === 'string' && word ? `${i18n}.${by.group}.${value}.${word}` : neutral;
}
