import { diffField, type FieldDiff } from '../version-comparison';

/** What a Devil Fruit Type says in one language. */
export interface DevilFruitTypeTranslation {
  name: string | null;
  description: string | null;
}

/** What a version of a Devil Fruit Type says: one romaji, and a translation per language code. */
export interface DevilFruitType {
  romaji: string | null;
  translations: Record<string, DevilFruitTypeTranslation>;
}

/** A language is complete when both its name and its description are filled in. */
export function isTranslationComplete(translation: DevilFruitTypeTranslation | undefined): boolean {
  return !!translation?.name?.trim() && !!translation.description?.trim();
}

/** The names of a Devil Fruit Type per language code, for the languages that have one. */
export function namesOf(devilFruitType: DevilFruitType): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [language, translation] of Object.entries(devilFruitType.translations)) {
    if (translation.name) {
      names[language] = translation.name;
    }
  }
  return names;
}

/** The longest each text may be - the backend refuses a longer one. */
export const ROMAJI_MAX_LENGTH = 100;
export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 2000;

/** What the editor holds for one language while a draft is being written: never `null`. */
export interface TranslationDraft {
  name: string;
  description: string;
}

/** A Devil Fruit Type while it is being written: every text a string, one translation per language. */
export interface DevilFruitTypeDraft {
  romaji: string;
  translations: Record<string, TranslationDraft>;
}

/**
 * What the editor starts from: what the version says - nothing, for a new content - with a
 * translation for each language of the catalog, so every tab has something to bind to.
 */
export function draftOf(
  devilFruitType: DevilFruitType | null,
  languages: readonly string[],
): DevilFruitTypeDraft {
  const translations: Record<string, TranslationDraft> = {};
  for (const language of languages) {
    const translation = devilFruitType?.translations[language];
    translations[language] = {
      name: translation?.name ?? '',
      description: translation?.description ?? '',
    };
  }
  return { romaji: devilFruitType?.romaji ?? '', translations };
}

/** What a draft is saved as: no space around a text, and `null` where nothing was written. */
export function toDevilFruitType(draft: DevilFruitTypeDraft): DevilFruitType {
  const translations: Record<string, DevilFruitTypeTranslation> = {};
  for (const [language, translation] of Object.entries(draft.translations)) {
    translations[language] = {
      name: translation.name.trim() || null,
      description: translation.description.trim() || null,
    };
  }
  return { romaji: draft.romaji.trim() || null, translations };
}

/** One thing a version needs before it can go to review, and whether the draft has it. */
export interface ReadinessCheck {
  readonly field: DraftField;
  /** The language of a name or a description; `null` for the romaji, shared by all. */
  readonly language: string | null;
  readonly done: boolean;
}

export type DraftField = 'romaji' | 'name' | 'description';

/**
 * What a draft still needs to be ready for review: the romaji, then a name and a
 * description in every language of the catalog (flows document 3.2). A draft is saved
 * without any of them - this only says how far it is.
 */
export function readinessChecks(
  draft: DevilFruitTypeDraft,
  languages: readonly string[],
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [
    { field: 'romaji', language: null, done: !!draft.romaji.trim() },
  ];
  for (const language of languages) {
    const translation = draft.translations[language];
    checks.push(
      { field: 'name', language, done: !!translation?.name.trim() },
      { field: 'description', language, done: !!translation?.description.trim() },
    );
  }
  return checks;
}

/**
 * Where the backend says a value is at fault, as the editor addresses its fields: `romaji`,
 * or `it.name`. The backend names them `romaji` and `translations[it].name`; anything else
 * is `null`.
 */
export function draftFieldKey(field: string): string | null {
  if (field === 'romaji') {
    return field;
  }
  const translation = /^translations\[([^\]]+)\]\.(name|description)$/.exec(field);
  return translation ? `${translation[1]}.${translation[2]}` : null;
}

/** One field of a Devil Fruit Type: the romaji, or a name or a description in one language. */
export interface DevilFruitTypeField {
  readonly field: DraftField;
  /** The language of a name or a description; `null` for the romaji, shared by all. */
  readonly language: string | null;
}

/**
 * Compares a version of a Devil Fruit Type with its base - `null`, an empty content, for the
 * first version (UF-CNT-21): the romaji, then the names, then the descriptions, one per
 * language present on either side - a language on one side only shows as added or removed.
 * Languages follow the catalog's order, any outside it last. A field empty on both sides is
 * left out.
 */
export function diffDevilFruitTypes(
  base: DevilFruitType | null,
  target: DevilFruitType,
  catalogOrder: readonly string[],
): FieldDiff<DevilFruitTypeField>[] {
  const languages = languagesOf(base, target, catalogOrder);
  const translation = (devilFruitType: DevilFruitType | null, language: string) =>
    devilFruitType?.translations[language];
  const diffs = [
    diffField<DevilFruitTypeField>(
      { field: 'romaji', language: null },
      base?.romaji,
      target.romaji,
    ),
    ...languages.map((language) =>
      diffField<DevilFruitTypeField>(
        { field: 'name', language },
        translation(base, language)?.name,
        translation(target, language)?.name,
      ),
    ),
    ...languages.map((language) =>
      diffField<DevilFruitTypeField>(
        { field: 'description', language },
        translation(base, language)?.description,
        translation(target, language)?.description,
      ),
    ),
  ];
  return diffs.filter((diff) => diff !== null);
}

/** The languages either version has a translation in: the catalog's first, then the rest. */
function languagesOf(
  base: DevilFruitType | null,
  target: DevilFruitType,
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

/** The illustration that stands for a Devil Fruit Type wherever the app shows an icon. */
export const DEVIL_FRUIT_TYPE_ICON = 'assets/devil-fruit-type.png';
