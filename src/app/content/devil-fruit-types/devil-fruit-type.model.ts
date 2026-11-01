import {
  countColumn,
  paragraphListField,
  localizedTextField,
  relatedList,
  storyPointField,
  subcategoryListField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Devil Fruit Type: one romaji, a name per language, a description, advantages and
 * disadvantages in paragraphs (one section each) and its subcategories,
 * if any, in display order (Zoan: Ancient, Mythical, Artificial). Fruits point to it:
 * its list counts them, and its card lists a few.
 */
export const DEVIL_FRUIT_TYPE: EntityDefinition = {
  entityType: 'DEVIL_FRUIT_TYPE',
  naturalKey: 'romaji',
  route: '/content/devil-fruit-types',
  api: '/api/content/devil-fruit-types',
  i18n: 'content.devilFruitTypes',
  icon: 'assets/devil-fruit-type.webp',
  labelField: 'name',
  fields: [
    textField('romaji', { maxLength: 100 }),
    storyPointField('firstAppearance'),
    localizedTextField('name', { maxLength: 100 }),
    paragraphListField('description', { rows: 5 }),
    paragraphListField('advantages', { rows: 5 }),
    paragraphListField('disadvantages', { rows: 5 }),
    subcategoryListField('subcategories', { nameMaxLength: 100, descriptionMaxLength: 2000 }),
  ],
  counts: [countColumn('devilFruitCount', { of: 'DEVIL_FRUIT', by: 'type' })],
  sections: [relatedList({ of: 'DEVIL_FRUIT', by: 'type' })],
};
