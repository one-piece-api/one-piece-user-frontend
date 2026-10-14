/**
 * How one content points to another, as the API shows it: not the bare id the pointing
 * content is saved with, but the content as it is today - its id, its romaji or number and
 * its name per language - so a screen can name it without asking for it. No Angular in here.
 */

export interface EntityReference {
  readonly id: string;
  readonly names: Record<string, string>;
  /** The natural key of a Devil Fruit or type. */
  readonly romaji?: string | null;
  /** The natural key of a story content (saga, arc, volume, chapter, episode). */
  readonly number?: number | null;
}

/** Whether a value read from the API or held by the editor is a reference, not an absent one. */
export function isReference(value: unknown): value is EntityReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (value as { id: string }).id !== ''
  );
}

/**
 * What to call the content in `language`: its name there, else its romaji, else its id. A
 * numbered one is "12 · Name" - just the number where it has no name in the language.
 */
export function referenceLabel(reference: EntityReference, language: string): string {
  const name = reference.names[language];
  if (typeof reference.number === 'number') {
    return name ? `${reference.number} · ${name}` : String(reference.number);
  }
  return name || reference.romaji || reference.id;
}
