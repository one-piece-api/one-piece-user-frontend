/**
 * The subcategories of a content (a type's Ancient, Mythical, Artificial) and the one another
 * content picks among them, as the API shows them and as the editor holds them. Matched by
 * id, which the backend gives and keeps across versions: a rename is still the same one. No
 * Angular in here.
 */
import { isReference } from './entity-reference';

/** What a subcategory says in one language. */
export interface SubcategoryTexts {
  readonly name: string | null;
  readonly description: string | null;
}

/** A subcategory of a saved version. */
export interface SavedSubcategory {
  readonly id: string;
  readonly translations: Record<string, SubcategoryTexts>;
}

/** The two texts of a subcategory, in the order they are read. */
export const SUBCATEGORY_PARTS = ['name', 'description'] as const;
export type SubcategoryPart = (typeof SUBCATEGORY_PARTS)[number];

/**
 * A subcategory while it is written: `id` is `null` for one just added - the backend gives it
 * at the save - and `key` tells the rows apart on screen until then.
 */
export interface SubcategoryDraft {
  readonly id: string | null;
  readonly key: string;
  readonly translations: Record<string, Partial<Record<SubcategoryPart, string>>>;
}

/** A subcategory as the content picking it shows it: its id and its name per language. */
export interface SubcategoryReference {
  readonly id: string;
  readonly names: Record<string, string>;
}

let nextKey = 0;

/** A key for a row of the editor, unique while the page lives. */
export function newSubcategoryKey(): string {
  return `subcategory-${nextKey++}`;
}

/** The subcategories of a value read from the API, in order; none for anything else. */
export function subcategoriesOf(value: unknown): SavedSubcategory[] {
  return Array.isArray(value) ? value.filter(isReference).map(asSaved) : [];
}

function asSaved(value: { id: string }): SavedSubcategory {
  const translations = (value as { translations?: unknown }).translations;
  return {
    id: value.id,
    translations:
      typeof translations === 'object' && translations !== null
        ? (translations as Record<string, SubcategoryTexts>)
        : {},
  };
}

/** Whether a value is a subcategory picked, not an absent one. */
export function isSubcategoryReference(value: unknown): value is SubcategoryReference {
  return isReference(value);
}

/** The subcategories a reference to a content offers, in order; none when it offers none. */
export function subcategoryChoices(reference: unknown): SubcategoryReference[] {
  const offered = isReference(reference)
    ? (reference as { subcategories?: unknown }).subcategories
    : undefined;
  return Array.isArray(offered) ? offered.filter(isSubcategoryReference) : [];
}

/** What to call a subcategory in `language`: its name there, else in any language, else its id. */
export function subcategoryLabel(reference: SubcategoryReference, language: string): string {
  return reference.names[language] || Object.values(reference.names).find(Boolean) || reference.id;
}

/** The text of one part of a subcategory - saved or being written - in one language. */
export function subcategoryText(
  subcategory: { readonly translations: Record<string, unknown> },
  language: string,
  part: SubcategoryPart,
): string {
  const texts = subcategory.translations[language] as Record<string, unknown> | undefined;
  const text = texts?.[part];
  return typeof text === 'string' ? text : '';
}

/** The names of a saved subcategory per language, for the languages that have one. */
export function subcategoryNames(subcategory: SavedSubcategory): Record<string, string> {
  return Object.fromEntries(
    Object.keys(subcategory.translations)
      .map((language) => [language, subcategoryText(subcategory, language, 'name').trim()])
      .filter(([, name]) => name),
  );
}
