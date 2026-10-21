/**
 * What a version of any entity says, and the pure functions the entity pages derive from it:
 * each walks the fields of the entity's definition and leaves every value to the field's
 * kind (`field-kinds.ts`). No Angular in here, so each one is testable on its own.
 */
import { diffField, type FieldDiff } from '../version-comparison';
import {
  naturalKeyParts,
  type EntityDefinition,
  type EntityField,
  type PartField,
  type PartListField,
} from './entity-definition';
import { chosenFileOf, isImageDraft, isImageReference } from './entity-image';
import {
  identityOf,
  isPartEntryDraft,
  itemsOf,
  localizedTextsOf,
  partListFieldKey,
  partValueOf,
} from './entity-part-list';
import {
  SUBCATEGORY_PARTS,
  subcategoriesOf,
  subcategoryNames,
  subcategoryText,
  type SavedSubcategory,
} from './entity-subcategory';
import { FIELD_KINDS, isAskedByReview, sentPartEntries } from './field-kinds';

/** What a version says in one language, by field key. */
export type Translation = Record<string, unknown>;

/**
 * What a version says: the fields shared by every language at the top level, the others in
 * a translation per language code - as the backend sends and receives it. Every entity has
 * a natural key (the backend's `ContentBody`), named by the definition: what a content is called
 * where it has no name.
 */
export interface EntityBody {
  readonly [field: string]: unknown;
  readonly translations: Record<string, Translation>;
}

/** What the editor holds for one language while a draft is being written. */
export type TranslationDraft = Record<string, unknown>;

/** A version while it is being written: one translation per language of the catalog. */
export interface EntityDraft {
  [field: string]: unknown;
  translations: Record<string, TranslationDraft>;
}

/** One field of a version: a shared one, or a translated one in one language. */
export interface EntityFieldRef {
  readonly field: string;
  /** The language of a translated field; `null` for a field shared by all. */
  readonly language: string | null;
  /** One text of one entry of a list - a subcategory's name - when the field is a list. */
  readonly entry?: FieldEntry;
}

/**
 * One value of one entry of a list field - a text in one language, the entry's first
 * appearance, a part of a `partList` entry or where that entry stands: which entry, where it
 * stands, how it is called.
 */
export interface FieldEntry {
  readonly id: string;
  /** Its place in the list, from 1. */
  readonly position: number;
  /** A subcategory's text or first appearance, a part's key, or `position` for a move. */
  readonly part: string;
  /** Its name in the language of the reference, `null` where it has none. */
  readonly name: string | null;
}

/** One thing a version needs before it can go to review, and whether the draft has it. */
export interface ReadinessCheck extends EntityFieldRef {
  readonly done: boolean;
}

function kindOf(field: EntityField) {
  return FIELD_KINDS[field.kind];
}

/** The fields written once on the version, such as the natural key. */
export function sharedFields(definition: EntityDefinition): EntityField[] {
  return definition.fields.filter((field) => !kindOf(field).localized);
}

/** The fields written once per language, such as the name. */
export function localizedFields(definition: EntityDefinition): EntityField[] {
  return definition.fields.filter((field) => kindOf(field).localized);
}

/** A language is complete when every one of its fields review asks for is filled in. */
export function isTranslationComplete(
  definition: EntityDefinition,
  translation: Translation | undefined,
): boolean {
  return localizedFields(definition)
    .filter(isAskedByReview)
    .every((field) => kindOf(field).isFilled(translation?.[field.key]));
}

/** The fields that are lists of subcategories, such as a type's. */
function subcategoryListFields(definition: EntityDefinition): EntityField[] {
  return definition.fields.filter(({ kind }) => kind === 'subcategoryList');
}

/**
 * A language is complete - saved or being written - when every translated field and every
 * subcategory's name and description are filled in there.
 */
export function isLanguageComplete(
  definition: EntityDefinition,
  value: EntityBody | EntityDraft,
  language: string,
): boolean {
  return (
    isTranslationComplete(definition, value.translations[language]) &&
    subcategoryChecks(definition, value, language).every(({ done }) => done) &&
    partListChecks(definition, value, language).every(({ done }) => done)
  );
}

/** The fields that are lists of entries made of parts, such as a character's epithets. */
export function partListFields(definition: EntityDefinition): PartListField[] {
  return definition.fields.filter((field): field is PartListField => field.kind === 'partList');
}

/**
 * Whether each entry of a `partList` has its localized parts written in `language` - the
 * text of each epithet - as the backend asks before review (`epithets[1].text[en]`). Only
 * the entries the JSON carries: one added and left empty is not saved, so not asked for.
 */
function partListChecks(
  definition: EntityDefinition,
  value: EntityBody | EntityDraft,
  language: string,
): ReadinessCheck[] {
  return partListFields(definition).flatMap((field) => {
    const items = itemsOf(value[field.key]);
    const entries = items.some(isPartEntryDraft) ? sentPartEntries(field, items) : items;
    return entries.flatMap((item, index) =>
      field.parts.filter(isAskedByReview).flatMap((part) =>
        part.kind === 'localizedText'
          ? [
              {
                field: field.key,
                language,
                entry: {
                  id: isPartEntryDraft(item) ? item.key : String(index),
                  position: index + 1,
                  part: part.key,
                  name: null,
                },
                done: !!localizedTextsOf(partValueOf(field, item, part))[language]?.trim(),
              },
            ]
          : [],
      ),
    );
  });
}

/** Whether each subcategory has its name and its description in `language`. */
function subcategoryChecks(
  definition: EntityDefinition,
  value: EntityBody | EntityDraft,
  language: string,
): ReadinessCheck[] {
  return subcategoryListFields(definition).flatMap((field) =>
    entriesOf(value[field.key]).flatMap((subcategory, index) =>
      SUBCATEGORY_PARTS.map((part) => ({
        field: field.key,
        language,
        entry: {
          id: subcategory.id ?? subcategory.key ?? String(index),
          position: index + 1,
          part,
          name: subcategoryText(subcategory, language, 'name').trim() || null,
        },
        done: !!subcategoryText(subcategory, language, part).trim(),
      })),
    ),
  );
}

/** The entries of a list, saved or being written. */
function entriesOf(
  value: unknown,
): { id: string | null; key?: string; translations: Record<string, unknown> }[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The natural key of a version - its romaji, a chapter number - as text; the parts of a
 * composite one joined by a space, as the backend writes it (`Monkey D. Luffy 3000000000`);
 * `null` where none is set.
 */
export function naturalKeyOf(
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>>,
): string | null {
  const parts = naturalKeyParts(definition)
    .map((key) => body[key])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(String);
  return parts.length ? parts.join(' ') : null;
}

/**
 * The names of a version per language code - its `labelField` - for the languages that have
 * one; none for an entity without a localized name.
 */
export function namesOf(definition: EntityDefinition, body: EntityBody): Record<string, string> {
  const names: Record<string, string> = {};
  const { labelField } = definition;
  if (!labelField) {
    return names;
  }
  for (const [language, translation] of Object.entries(body.translations)) {
    const name = translation[labelField];
    if (typeof name === 'string' && name) {
      names[language] = name;
    }
  }
  return names;
}

/**
 * What the editor starts from: what the version says - nothing, for a new content - with a
 * translation for each language of the catalog, so every tab has something to bind to.
 */
export function draftOf(
  definition: EntityDefinition,
  body: EntityBody | null,
  languages: readonly string[],
): EntityDraft {
  const draft: EntityDraft = {
    ...Object.fromEntries(naturalKeyParts(definition).map((key) => [key, ''])),
    translations: {},
  };
  for (const field of sharedFields(definition)) {
    draft[field.key] = kindOf(field).draftValue(body?.[field.key], field);
  }
  for (const language of languages) {
    const translation = body?.translations[language];
    draft.translations[language] = Object.fromEntries(
      localizedFields(definition).map((field) => [
        field.key,
        kindOf(field).draftValue(translation?.[field.key], field),
      ]),
    );
  }
  return draft;
}

/** What a draft is saved as: each value as its kind saves it. */
export function toBody(definition: EntityDefinition, draft: EntityDraft): EntityBody {
  const body: Record<string, unknown> = {};
  for (const field of sharedFields(definition)) {
    const value = kindOf(field).savedValue(draft[field.key], field);
    if (value !== undefined) {
      body[field.key] = value;
    }
  }
  const translations: Record<string, Translation> = {};
  for (const [language, translation] of Object.entries(draft.translations)) {
    translations[language] = Object.fromEntries(
      localizedFields(definition).map((field) => [
        field.key,
        kindOf(field).savedValue(translation[field.key], field),
      ]),
    );
  }
  return {
    ...Object.fromEntries(naturalKeyParts(definition).map((key) => [key, null])),
    ...body,
    translations,
  };
}

/** A file saved beside the JSON of a version, in the request part named after its field. */
export interface UploadedFile {
  readonly part: string;
  readonly file: File;
}

/** What saving a draft sends: the JSON, and the file to go beside it if one was chosen. */
export interface Upload {
  readonly body: EntityBody;
  readonly file: UploadedFile | null;
}

/**
 * What saving a draft sends, worked out from the draft and the version it was written from
 * (`null` for a new content). For an image: a file chosen is sent beside the JSON (replace);
 * no image where the saved version had one sets `removeImage` (remove); otherwise nothing,
 * and the backend keeps what the version had (plan D5).
 */
export function uploadOf(
  definition: EntityDefinition,
  draft: EntityDraft,
  saved: EntityBody | null,
): Upload {
  const flags: Record<string, true> = {};
  let file: UploadedFile | null = null;
  for (const field of definition.fields.filter(({ kind }) => kind === 'image')) {
    const chosen = chosenFileOf(draft[field.key]);
    if (chosen) {
      file = { part: field.key, file: chosen };
    } else if (!isImageDraft(draft[field.key]) && isImageReference(saved?.[field.key])) {
      flags[REMOVE_IMAGE_FLAG] = true;
    }
  }
  return { body: { ...toBody(definition, draft), ...flags }, file };
}

/** How the backend is told to drop the image of a draft, whatever the image field is called. */
const REMOVE_IMAGE_FLAG = 'removeImage';

/**
 * What a draft still needs to be ready for review: the shared fields, then every translated
 * field in every language of the catalog (flows document 3.2). A draft is saved without any
 * of them - this only says how far it is.
 */
export function readinessChecks(
  definition: EntityDefinition,
  draft: EntityDraft,
  languages: readonly string[],
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = sharedFields(definition)
    .filter(isAskedByReview)
    .map((field) => ({
      field: field.key,
      language: null,
      done: kindOf(field).isFilled(draft[field.key]),
    }));
  for (const language of languages) {
    const translation = draft.translations[language];
    checks.push(
      ...localizedFields(definition)
        .filter(isAskedByReview)
        .map((field) => ({
          field: field.key,
          language,
          done: kindOf(field).isFilled(translation?.[field.key]),
        })),
      ...subcategoryChecks(definition, draft, language),
      ...partListChecks(definition, draft, language),
    );
  }
  return checks;
}

/** The fields that are lists of releases or broadcasts, such as a volume's. */
function releaseListFields(definition: EntityDefinition): EntityField[] {
  return definition.fields.filter(({ kind }) => kind === 'releaseList');
}

/**
 * Where the backend says a value is at fault, as the editor addresses its fields: the natural
 * key (`romaji`, `number`), `it.name`, `it.subcategories.0.name`, `subcategories.0` or
 * `releases.1.country`. The backend names them `romaji`, `translations[it].name`,
 * `subcategories[0].translations[it].name`, `subcategories[0].id` and `releases[1].country` -
 * a release by its position in the JSON sent (`sentReleaseRows`). An entry of a `partList`
 * is `species.1` or `epithets.1.text.en`, by its position in the JSON sent
 * (`sentPartEntries`; see `partListFieldKey`). Anything else is `null`.
 */
export function draftFieldKey(definition: EntityDefinition, field: string): string | null {
  const entryOfPartList = partListFieldKey(partListFields(definition), field);
  if (entryOfPartList) {
    return entryOfPartList;
  }
  const lists = subcategoryListFields(definition).map(({ key }) => key);
  const entry = new RegExp(
    String.raw`^(${lists.join('|')})\[(\d+)\](?:\.translations\[([^\]]+)\]\.(name|description)|\.(firstAppearance)(?:\.(?:chapter|episode))?|\.id)?$`,
  ).exec(field);
  if (lists.length && entry) {
    const [, list, index, language, part, firstAppearance] = entry;
    if (firstAppearance) {
      return `${list}.${index}.${firstAppearance}`;
    }
    return language ? `${language}.${list}.${index}.${part}` : `${list}.${index}`;
  }
  const releases = releaseListFields(definition).map(({ key }) => key);
  const release = new RegExp(String.raw`^(${releases.join('|')})\[(\d+)\]\.(country|date)$`).exec(
    field,
  );
  if (releases.length && release) {
    return `${release[1]}.${release[2]}.${release[3]}`;
  }
  if (sharedFields(definition).some(({ key }) => key === field)) {
    return field;
  }
  // A story point is refused as a whole or by a part: `firstAppearance.episode`.
  const storyPoint = /^(\w+)\.(?:chapter|episode)$/.exec(field)?.[1];
  if (
    storyPoint &&
    definition.fields.some(({ key, kind }) => key === storyPoint && kind === 'storyPoint')
  ) {
    return storyPoint;
  }
  const keys = localizedFields(definition).map(({ key }) => key);
  const translation = new RegExp(String.raw`^translations\[([^\]]+)\]\.(${keys.join('|')})$`).exec(
    field,
  );
  return translation ? `${translation[1]}.${translation[2]}` : null;
}

/**
 * Compares a version with its base - `null`, an empty content, for the first version
 * (UF-CNT-21): the fields in the definition's order, a translated one once per language
 * present on either side - a language on one side only shows as added or removed.
 * Languages follow the catalog's order, any outside it last. A field empty on both sides is
 * left out.
 */
export function diffBodies(
  definition: EntityDefinition,
  base: EntityBody | null,
  target: EntityBody,
  catalogOrder: readonly string[],
): FieldDiff<EntityFieldRef>[] {
  const languages = languagesOf(definition, base, target, catalogOrder);
  const diffs = definition.fields.flatMap((field) =>
    field.kind === 'subcategoryList'
      ? diffSubcategories(field.key, base?.[field.key], target[field.key], languages)
      : field.kind === 'partList'
        ? diffPartList(field, base?.[field.key], target[field.key], languages)
        : kindOf(field).localized
          ? languages.map((language) =>
              kindOf(field).diff<EntityFieldRef>(
                { field: field.key, language },
                base?.translations[language]?.[field.key],
                target.translations[language]?.[field.key],
              ),
            )
          : [
              kindOf(field).diff<EntityFieldRef>(
                { field: field.key, language: null },
                base?.[field.key],
                target[field.key],
              ),
            ],
  );
  return diffs.filter((diff) => diff !== null);
}

/**
 * Compares two lists of subcategories, matched by id: each subcategory in the list's order,
 * then those removed; for each, its name and description per language - one added or
 * removed shows all its texts as added or removed, one renamed only its name as modified.
 */
function diffSubcategories(
  key: string,
  before: unknown,
  after: unknown,
  languages: readonly string[],
): (FieldDiff<EntityFieldRef> | null)[] {
  const was = subcategoriesOf(before);
  const is = subcategoriesOf(after);
  const removed = was.filter(({ id }) => !is.some((subcategory) => subcategory.id === id));
  return [...is, ...removed].flatMap((subcategory) => {
    const old = was.find(({ id }) => id === subcategory.id);
    const now = is.find(({ id }) => id === subcategory.id);
    const position = (now ? is.indexOf(now) : was.indexOf(subcategory)) + 1;
    const texts = languages.flatMap((language) => {
      const name =
        (now && subcategoryText(now, language, 'name').trim()) ||
        (old && subcategoryText(old, language, 'name').trim()) ||
        null;
      return SUBCATEGORY_PARTS.map((part) =>
        diffField<EntityFieldRef>(
          { field: key, language, entry: { id: subcategory.id, position, part, name } },
          old && subcategoryText(old, language, part),
          now && subcategoryText(now, language, part),
        ),
      );
    });
    // Not translated: compared once, named by whatever name the subcategory has.
    const anyName = (side?: SavedSubcategory) =>
      side ? (Object.values(subcategoryNames(side))[0] ?? null) : null;
    const firstAppearance = FIELD_KINDS.storyPoint.diff<EntityFieldRef>(
      {
        field: key,
        language: null,
        entry: {
          id: subcategory.id,
          position,
          part: 'firstAppearance',
          name: anyName(now) ?? anyName(old),
        },
      },
      old?.firstAppearance,
      now?.firstAppearance,
    );
    return [...texts, firstAppearance];
  });
}

/** The languages of a version's translations and of the localized parts of its lists. */
function languagesWritten(definition: EntityDefinition, body: EntityBody): string[] {
  const inLists = partListFields(definition).flatMap((field) =>
    field.parts
      .filter(({ kind }) => kind === 'localizedText')
      .flatMap((part) =>
        itemsOf(body[field.key]).flatMap((item) =>
          Object.keys(localizedTextsOf(partValueOf(field, item, part))),
        ),
      ),
  );
  return [...Object.keys(body.translations), ...inLists];
}

/** The part of a comparison row that says an entry of a `partList` moved. */
export const POSITION_PART = 'position';

/** An entry of a `partList` in both versions, or in one: where it stood, where it stands. */
interface EntryPair {
  readonly old?: unknown;
  readonly oldPosition: number;
  readonly now?: unknown;
  readonly position: number;
}

/**
 * The entries of two versions of a `partList`, paired: by their unique part where the list
 * has one - so an entry that moved is still the same one - else by position. The entries of
 * the version compared in order, then those it removed, at the place they had.
 */
function pairEntries(
  field: PartListField,
  was: readonly unknown[],
  is: readonly unknown[],
): EntryPair[] {
  if (!field.unique) {
    return Array.from({ length: Math.max(was.length, is.length) }, (_, index) => ({
      ...(index < was.length ? { old: was[index] } : {}),
      ...(index < is.length ? { now: is[index] } : {}),
      oldPosition: index + 1,
      position: index + 1,
    }));
  }
  const unmatched = new Set(was.keys());
  const pairs = is.map((now, index): EntryPair => {
    const identity = identityOf(field, now);
    const match = [...unmatched].find(
      (oldIndex) => identity !== null && identityOf(field, was[oldIndex]) === identity,
    );
    if (match === undefined) {
      return { now, oldPosition: index + 1, position: index + 1 };
    }
    unmatched.delete(match);
    return { old: was[match], oldPosition: match + 1, now, position: index + 1 };
  });
  const removed = [...unmatched].map((oldIndex): EntryPair => ({
    old: was[oldIndex],
    oldPosition: oldIndex + 1,
    position: oldIndex + 1,
  }));
  return [...pairs, ...removed];
}

/**
 * Compares two versions of a `partList` entry by entry (`pairEntries`): each part as its kind
 * compares it - a localized one once per language - and, for an entry that moved, a row
 * saying from where to where. An entry added or removed shows all its parts so.
 */
function diffPartList(
  field: PartListField,
  before: unknown,
  after: unknown,
  languages: readonly string[],
): (FieldDiff<EntityFieldRef> | null)[] {
  return pairEntries(field, itemsOf(before), itemsOf(after)).flatMap(
    ({ old, oldPosition, now, position }) => {
      // A removed entry keeps its old place as `position`, so `#n` is never shared.
      const id = identityOf(field, now !== undefined ? now : old) ?? `#${position}`;
      const ref = (part: string, language: string | null): EntityFieldRef => ({
        field: field.key,
        language,
        entry: { id, position, part, name: null },
      });
      const valueIn = (item: unknown, part: PartField) =>
        item === undefined ? undefined : partValueOf(field, item, part);
      const parts = field.parts.flatMap((part) =>
        part.kind === 'localizedText'
          ? languages.map((language) =>
              diffField(
                ref(part.key, language),
                localizedTextsOf(valueIn(old, part))[language],
                localizedTextsOf(valueIn(now, part))[language],
              ),
            )
          : [kindOf(part).diff(ref(part.key, null), valueIn(old, part), valueIn(now, part))],
      );
      const moved =
        old !== undefined && now !== undefined && oldPosition !== position
          ? diffField(ref(POSITION_PART, null), String(oldPosition), String(position))
          : null;
      return [...parts, moved];
    },
  );
}

/**
 * The languages either version is written in - its translations and the localized parts of
 * its lists (an epithet), as the backend counts them: the catalog's first, then the rest.
 */
function languagesOf(
  definition: EntityDefinition,
  base: EntityBody | null,
  target: EntityBody,
  catalogOrder: readonly string[],
): string[] {
  const present = new Set(
    [base, target].flatMap((body) => (body ? languagesWritten(definition, body) : [])),
  );
  const inCatalog = catalogOrder.filter((language) => present.has(language));
  const outside = [...present].filter((language) => !catalogOrder.includes(language)).sort();
  return [...inCatalog, ...outside];
}
