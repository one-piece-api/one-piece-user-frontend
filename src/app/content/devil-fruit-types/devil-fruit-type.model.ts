import {
  countColumn,
  localizedTextField,
  relatedList,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Devil Fruit Type: one romaji, and a name, a description, advantages and disadvantages
 * per language - the longest each may be is what the backend accepts. Fruits point to it:
 * its list counts them, and its card lists a few.
 */
export const DEVIL_FRUIT_TYPE: EntityDefinition = {
  entityType: 'DEVIL_FRUIT_TYPE',
  route: '/content/devil-fruit-types',
  api: '/api/content/devil-fruit-types',
  i18n: 'content.devilFruitTypes',
  icon: 'assets/devil-fruit-type.webp',
  fields: [
    textField('romaji', { maxLength: 100 }),
    localizedTextField('name', { maxLength: 100 }),
    localizedTextField('description', { maxLength: 2000, rows: 8, layout: 'wide' }),
    localizedTextField('advantages', { maxLength: 2000, rows: 5, layout: 'pair' }),
    localizedTextField('disadvantages', { maxLength: 2000, rows: 5, layout: 'pair' }),
  ],
  counts: [countColumn('devilFruitCount', { of: 'DEVIL_FRUIT', by: 'type' })],
  sections: [relatedList({ of: 'DEVIL_FRUIT', by: 'type' })],
};
