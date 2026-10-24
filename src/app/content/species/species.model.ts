import {
  imageField,
  localizedTextField,
  relatedList,
  storyPointField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * What the picture of a species must be - the backend's profile `species`: at least 400 × 500
 * and close to 4:5, a PNG or WebP with no transparency required, at most 5 MB and 25 megapixels. The
 * backend fits it into a 320 × 400 canvas.
 */
const SPECIES_PICTURE = {
  width: 320,
  height: 400,
  minWidth: 400,
  minHeight: 500,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 0,
};

/**
 * The Species: the race of a character - Human, Fish-Man, Mink, Giant (plan D1). One romaji,
 * a name and a description per language (D2, D3), the first appearance (D4) and, optionally,
 * a picture of a typical member (D5). `species` is both singular and plural.
 */
export const SPECIES: EntityDefinition = {
  entityType: 'SPECIES',
  naturalKey: 'romaji',
  route: '/content/species',
  api: '/api/content/species',
  i18n: 'content.species',
  icon: '⚇',
  labelField: 'name',
  fields: [
    textField('romaji', { maxLength: 100 }),
    imageField('image', SPECIES_PICTURE, { hint: 'content.species.imageHint' }),
    storyPointField('firstAppearance'),
    localizedTextField('name', { maxLength: 100 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
  ],
  // The characters of the species: a few on its card, all in their list filtered by it (C3, 4c).
  sections: [relatedList({ of: 'CHARACTER', by: 'species' })],
};
