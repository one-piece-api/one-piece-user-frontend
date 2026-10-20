import type { TranslocoService } from '@jsverse/transloco';
import { naturalKeyOf } from './entity-body';
import { isNumbered, type EntityDefinition } from './entity-definition';

export { isNumbered };

/**
 * What a content is called where it has no name in the language: what its definition calls it
 * (`label`, a bounty), else its romaji, or - for a numbered one - "Chapter 12". `null` while
 * it has no natural key yet.
 */
export function untitledOf(
  transloco: TranslocoService,
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>>,
): string | null {
  if (definition.label) {
    return definition.label(body, transloco.getActiveLang());
  }
  const key = naturalKeyOf(definition, body);
  if (key === null) {
    return null;
  }
  return isNumbered(definition) ? `${transloco.translate(`${definition.i18n}.one`)} ${key}` : key;
}
