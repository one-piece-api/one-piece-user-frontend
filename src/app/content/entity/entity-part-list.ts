/**
 * The entries of a `partList` field - a character's epithets, aliases, species - as the API
 * sends them and as the editor holds them: where each part's value is in an entry, what
 * identifies an entry, and where the backend says one is at fault. How each value is read,
 * saved and compared is its part's kind (`field-kinds.ts`). No Angular in here.
 */
import {
  storyPointField,
  type ChoiceField,
  type PartField,
  type PartListField,
  type StoryPointField,
} from './entity-definition';
import { isReference } from './entity-reference';
import { STORY_POINT_PARTS, isStoryPointFilled, type StoryPointPart } from './entity-story-point';

/** Where the reader learns an entry of a `windowed` list starts being true: asked for by review. */
export const DISCOVERED_PART: StoryPointField = storyPointField('discovered');

/** Where the reader learns it stops being true: optional, its end makes the entry former. */
export const ENDED_PART: StoryPointField = storyPointField('ended', { optional: true });

/** The two points of a window, as every entry of a `windowed` list carries them. */
export const WINDOW_PARTS: readonly StoryPointField[] = [DISCOVERED_PART, ENDED_PART];

/** Every part of an entry: those the definition lists, then the window of a `windowed` list. */
export function partsOf(field: PartListField): readonly PartField[] {
  return field.windowed ? [...field.parts, ...WINDOW_PARTS] : field.parts;
}

/** Whether a part is one of the two points of a window. */
export function isWindowPart(part: PartField): boolean {
  return WINDOW_PARTS.some(({ key }) => key === part.key) && part.kind === 'storyPoint';
}

/** The lists an entry holds as parts of its own: a membership's periods. */
export function nestedListsOf(field: PartListField): PartListField[] {
  return field.parts.filter((part): part is PartListField => part.kind === 'partList');
}

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
  const parts = partsOf(field);
  return parts.length === 1 && parts[0].kind !== 'localizedText';
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
 * Whether an entry is former, as the unfiltered reading has it (workflow 3.7.2): in a `windowed`
 * list, its `ended` has a part; an entry holding windowed lists (a membership) when it has
 * entries there and every one is former. An entry of any other list never is.
 */
export function isFormer(field: PartListField, item: unknown): boolean {
  if (field.windowed) {
    return isStoryPointFilled(partValueOf(field, item, ENDED_PART));
  }
  const nested = nestedListsOf(field).filter(({ windowed }) => windowed);
  return (
    nested.length > 0 &&
    nested.every((list) => {
      const entries = itemsOf(partValueOf(field, item, list));
      return entries.length > 0 && entries.every((entry) => isFormer(list, entry));
    })
  );
}

/**
 * A path of the backend cut at its dots and brackets: `affiliations[0].periods[1].role[en]` is
 * `affiliations`, `0`, `periods`, `1`, `role`, `en`. `null` for one that is not such a path.
 */
function pathSegments(path: string): string[] | null {
  const segments: string[] = [];
  for (const token of path.split('.')) {
    const match = /^(\w+)(?:\[([^\]]+)\])?$/.exec(token);
    if (!match) {
      return null;
    }
    segments.push(...match.slice(1).filter((segment) => segment !== undefined));
  }
  return segments;
}

/**
 * Whether the segments after a list name one of its entries: its position, then optionally a
 * part - a localized one with its language, a story point with its chapter or episode, a
 * nested list with the same again.
 */
function isEntryPath(list: PartListField, [index, partKey, ...tail]: readonly string[]): boolean {
  if (index === undefined || !/^\d+$/.test(index)) {
    return false;
  }
  const part = partKey === undefined ? null : partsOf(list).find(({ key }) => key === partKey);
  if (partKey === undefined || !tail.length) {
    return partKey === undefined || part !== undefined;
  }
  switch (part?.kind) {
    case 'partList':
      return isEntryPath(part, tail);
    case 'localizedText':
      return tail.length === 1;
    case 'storyPoint':
      return tail.length === 1 && STORY_POINT_PARTS.includes(tail[0] as StoryPointPart);
    default:
      return false;
  }
}

/**
 * Where the backend says an entry is at fault, as the editor addresses it: `species[1]` is
 * `species.1`, `affiliations[0].periods[1].discovered.episode` is
 * `affiliations.0.periods.1.discovered.episode`, and `epithets[1].text[en]` is
 * `epithets.1.text.en` - every position the one in the JSON sent. `null` for a path that names
 * no entry of these lists.
 */
export function partListFieldKey(lists: readonly PartListField[], path: string): string | null {
  const segments = pathSegments(path);
  const list = lists.find(({ key }) => key === segments?.[0]);
  return segments && list && isEntryPath(list, segments.slice(1)) ? segments.join('.') : null;
}

/**
 * The part an entry's key names after its position - `periods.1.marineRank` of a membership -
 * and the list it belongs to, a nested one where the key goes down into it; `null` as the part
 * where the key names the entry alone or a part the list does not have.
 */
export function partAtPath(
  field: PartListField,
  [partKey, , ...tail]: readonly string[],
): { readonly list: PartListField; readonly part: PartField | null } {
  const part = partsOf(field).find(({ key }) => key === partKey) ?? null;
  return part?.kind === 'partList' && tail.length ? partAtPath(part, tail) : { list: field, part };
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
