/**
 * What a version of any entity says, and the pure functions the entity pages derive from it:
 * each walks the fields of the entity's definition and leaves every value to the field's
 * kind (`field-kinds.ts`). No Angular in here, so each one is testable on its own.
 */
import { diffField, type FieldDiff } from '../version-comparison';
import type { EntityDefinition, EntityField } from './entity-definition';
import { chosenFileOf, isImageDraft, isImageReference } from './entity-image';
import {
  SUBCATEGORY_PARTS,
  subcategoriesOf,
  subcategoryNames,
  subcategoryText,
  type SavedSubcategory,
  type SubcategoryPart,
} from './entity-subcategory';
import { FIELD_KINDS, isAskedByReview } from './field-kinds';

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
 * One value of one entry of a list field - a text in one language, or the entry's first
 * appearance: which entry, where it stands, how it is called.
 */
export interface FieldEntry {
  readonly id: string;
  /** Its place in the list, from 1. */
  readonly position: number;
  readonly part: SubcategoryPart | 'firstAppearance';
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
    subcategoryChecks(definition, value, language).every(({ done }) => done)
  );
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

/** The natural key of a version - its romaji, a chapter number - as text; `null` where unset. */
export function naturalKeyOf(
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>>,
): string | null {
  const value = body[definition.naturalKey];
  return value === null || value === undefined ? null : String(value);
}

/** The names of a version per language code - its `labelField` - for the languages that have one. */
export function namesOf(definition: EntityDefinition, body: EntityBody): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [language, translation] of Object.entries(body.translations)) {
    const name = translation[definition.labelField];
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
  const draft: EntityDraft = { [definition.naturalKey]: '', translations: {} };
  for (const field of sharedFields(definition)) {
    draft[field.key] = kindOf(field).draftValue(body?.[field.key]);
  }
  for (const language of languages) {
    const translation = body?.translations[language];
    draft.translations[language] = Object.fromEntries(
      localizedFields(definition).map((field) => [
        field.key,
        kindOf(field).draftValue(translation?.[field.key]),
      ]),
    );
  }
  return draft;
}

/** What a draft is saved as: each value as its kind saves it. */
export function toBody(definition: EntityDefinition, draft: EntityDraft): EntityBody {
  const body: Record<string, unknown> = {};
  for (const field of sharedFields(definition)) {
    const value = kindOf(field).savedValue(draft[field.key]);
    if (value !== undefined) {
      body[field.key] = value;
    }
  }
  const translations: Record<string, Translation> = {};
  for (const [language, translation] of Object.entries(draft.translations)) {
    translations[language] = Object.fromEntries(
      localizedFields(definition).map((field) => [
        field.key,
        kindOf(field).savedValue(translation[field.key]),
      ]),
    );
  }
  return { [definition.naturalKey]: null, ...body, translations };
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
 * a release by its position in the JSON sent (`sentReleaseRows`); anything else is `null`.
 */
export function draftFieldKey(definition: EntityDefinition, field: string): string | null {
  const lists = subcategoryListFields(definition).map(({ key }) => key);
  const entry = new RegExp(
    String.raw`^(${lists.join('|')})\[(\d+)\](?:\.translations\[([^\]]+)\]\.(name|description)|\.(firstAppearance)(?:\.chapter)?|\.id)?$`,
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
  // A story point is refused as a whole or by its chapter: `firstAppearance.chapter`.
  const storyPoint = /^(\w+)\.chapter$/.exec(field)?.[1];
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
  const languages = languagesOf(base, target, catalogOrder);
  const diffs = definition.fields.flatMap((field) =>
    field.kind === 'subcategoryList'
      ? diffSubcategories(field.key, base?.[field.key], target[field.key], languages)
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
      old && { chapter: old.firstAppearance },
      now && { chapter: now.firstAppearance },
    );
    return [...texts, firstAppearance];
  });
}

/** The languages either version has a translation in: the catalog's first, then the rest. */
function languagesOf(
  base: EntityBody | null,
  target: EntityBody,
  catalogOrder: readonly string[],
): string[] {
  const present = new Set([
    ...Object.keys(base?.translations ?? {}),
    ...Object.keys(target.translations),
  ]);
  const inCatalog = catalogOrder.filter((language) => present.has(language));
  const outside = [...present].filter((language) => !catalogOrder.includes(language)).sort();
  return [...inCatalog, ...outside];
}
