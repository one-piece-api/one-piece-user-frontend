import { InjectionToken } from '@angular/core';
import { DEVIL_FRUIT_TYPE } from '../devil-fruit-types/devil-fruit-type.model';
import type { EntityDefinition } from './entity-definition';

/**
 * The entities the app has pages for - the one place an entity is switched on: its routes,
 * its menu entry and its rows on the dashboard follow from here.
 */
export const ENTITIES: readonly EntityDefinition[] = [DEVIL_FRUIT_TYPE];

/** The definition of the entity a page belongs to, given by its route. */
export const ENTITY = new InjectionToken<EntityDefinition>('ENTITY');

/** The entity the API names so - `null` for one this app has no pages for yet. */
export function entityOf(entityType: string | null | undefined): EntityDefinition | null {
  return ENTITIES.find((entity) => entity.entityType === entityType) ?? null;
}

/**
 * How a content of an entity without pages is shown - one the backend already has and this
 * app not yet: by name only, without link or actions.
 */
export const UNKNOWN_ENTITY = {
  labelKey: 'content.entity.unknown',
  icon: 'assets/contents.webp',
} as const;

/** "Fruit Type": the translation key of one content of the entity, known or not. */
export function entityLabelKey(entity: EntityDefinition | null): string {
  return entity ? `${entity.i18n}.one` : UNKNOWN_ENTITY.labelKey;
}

export function entityIcon(entity: EntityDefinition | null): string {
  return entity?.icon ?? UNKNOWN_ENTITY.icon;
}
