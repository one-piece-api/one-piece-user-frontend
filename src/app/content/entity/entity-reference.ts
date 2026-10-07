/**
 * How one content points to another, as the API shows it: not the bare id the pointing
 * content is saved with, but the content as it is today - its id, its romaji and its name
 * per language - so a screen can name it without asking for it. No Angular in here.
 */

export interface EntityReference {
  readonly id: string;
  readonly romaji: string | null;
  readonly names: Record<string, string>;
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

/** What to call the content in `language`: its name there, else its romaji, else its id. */
export function referenceLabel(reference: EntityReference, language: string): string {
  return reference.names[language] || reference.romaji || reference.id;
}
