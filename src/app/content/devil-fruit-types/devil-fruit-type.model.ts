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
