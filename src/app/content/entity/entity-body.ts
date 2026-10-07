/**
 * What a version of any entity says, and the pure functions the entity pages derive from it:
 * each walks the fields of the entity's definition and leaves every value to the field's
 * kind (`field-kinds.ts`). No Angular in here, so each one is testable on its own.
 */
import type { FieldDiff } from '../version-comparison';
import type { EntityDefinition, EntityField } from './entity-definition';
import { FIELD_KINDS } from './field-kinds';

/** What a version says in one language, by field key. */
export type Translation = Record<string, unknown>;

/**
 * What a version says: the fields shared by every language at the top level, the others in
 * a translation per language code - as the backend sends and receives it. Every entity has
 * a romaji (the backend's `ContentBody`): what a content is called where it has no name.
 */
export interface EntityBody {
  readonly [field: string]: unknown;
  readonly romaji: string | null;
  readonly translations: Record<string, Translation>;
}

/** What the editor holds for one language while a draft is being written. */
export type TranslationDraft = Record<string, unknown>;

/** A version while it is being written: one translation per language of the catalog. */
export interface EntityDraft {
  [field: string]: unknown;
  romaji: string;
  translations: Record<string, TranslationDraft>;
}

/** One field of a version: a shared one, or a translated one in one language. */
export interface EntityFieldRef {
  readonly field: string;
  /** The language of a translated field; `null` for a field shared by all. */
  readonly language: string | null;
}

/** One thing a version needs before it can go to review, and whether the draft has it. */
export interface ReadinessCheck extends EntityFieldRef {
  readonly done: boolean;
}

function kindOf(field: EntityField) {
  return FIELD_KINDS[field.kind];
}

/** The fields written once on the version, such as the romaji. */
export function sharedFields(definition: EntityDefinition): EntityField[] {
  return definition.fields.filter((field) => !kindOf(field).localized);
}

/** The fields written once per language, such as the name. */
export function localizedFields(definition: EntityDefinition): EntityField[] {
  return definition.fields.filter((field) => kindOf(field).localized);
}

/** A language is complete when every one of its fields is filled in. */
export function isTranslationComplete(
  definition: EntityDefinition,
  translation: Translation | undefined,
): boolean {
  return localizedFields(definition).every((field) =>
    kindOf(field).isFilled(translation?.[field.key]),
  );
}

/** The names of a version per language code, for the languages that have one. */
export function namesOf(body: EntityBody): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [language, translation] of Object.entries(body.translations)) {
    if (typeof translation['name'] === 'string' && translation['name']) {
      names[language] = translation['name'];
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
  const draft: EntityDraft = { romaji: '', translations: {} };
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
    body[field.key] = kindOf(field).savedValue(draft[field.key]);
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
  return { romaji: null, ...body, translations };
}

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
  const checks: ReadinessCheck[] = sharedFields(definition).map((field) => ({
    field: field.key,
    language: null,
    done: kindOf(field).isFilled(draft[field.key]),
  }));
  for (const language of languages) {
    const translation = draft.translations[language];
    checks.push(
      ...localizedFields(definition).map((field) => ({
        field: field.key,
        language,
        done: kindOf(field).isFilled(translation?.[field.key]),
      })),
    );
  }
  return checks;
}

/**
 * Where the backend says a value is at fault, as the editor addresses its fields: `romaji`,
 * or `it.name`. The backend names them `romaji` and `translations[it].name`; anything else
 * is `null`.
 */
export function draftFieldKey(definition: EntityDefinition, field: string): string | null {
  if (sharedFields(definition).some(({ key }) => key === field)) {
    return field;
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
    kindOf(field).localized
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
