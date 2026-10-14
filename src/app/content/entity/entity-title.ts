import type { TranslocoService } from '@jsverse/transloco';
import { naturalKeyOf } from './entity-body';
import type { EntityDefinition } from './entity-definition';

/** Whether the entity is told apart by a number - a chapter - rather than a romaji. */
export function isNumbered(definition: EntityDefinition): boolean {
  return definition.fields.some(
    ({ key, kind }) => key === definition.naturalKey && kind === 'number',
  );
}

/**
 * What a content is called where it has no name in the language: its romaji, or - for a
 * numbered one - "Chapter 12". `null` while it has no natural key yet.
 */
export function untitledOf(
  transloco: TranslocoService,
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>>,
): string | null {
  const key = naturalKeyOf(definition, body);
  if (key === null) {
    return null;
  }
  return isNumbered(definition) ? `${transloco.translate(`${definition.i18n}.one`)} ${key}` : key;
}
