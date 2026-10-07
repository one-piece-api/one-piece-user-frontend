import {
  localizedTextField,
  relationField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Devil Fruit: one romaji, the type it belongs to, and a name, a description, advantages
 * and disadvantages per language - the longest each may be is what the backend accepts.
 * The type is a relation: a draft may not have chosen one, but review asks for it.
 */
export const DEVIL_FRUIT: EntityDefinition = {
  entityType: 'DEVIL_FRUIT',
  route: '/content/devil-fruits',
  api: '/api/content/devil-fruits',
  i18n: 'content.devilFruits',
  icon: 'assets/devil-fruit.webp',
  fields: [
    textField('romaji', { maxLength: 100 }),
    relationField('type', { target: 'DEVIL_FRUIT_TYPE' }),
    localizedTextField('name', { maxLength: 100 }),
    localizedTextField('description', { maxLength: 2000, rows: 8, layout: 'wide' }),
    localizedTextField('advantages', { maxLength: 2000, rows: 5, layout: 'pair' }),
    localizedTextField('disadvantages', { maxLength: 2000, rows: 5, layout: 'pair' }),
  ],
};
