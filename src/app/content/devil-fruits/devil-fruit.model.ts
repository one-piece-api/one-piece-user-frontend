import {
  imageField,
  localizedTextField,
  relationField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * What the image of a fruit must be - the backend's profile `devil-fruit` (plan D6): at
 * least 320 × 400 and close to 4:5, a PNG with a transparent background, at most 5 MB and
 * 25 megapixels. The backend fits it into a 320 × 400 canvas - the size of the fruit images
 * at hand (334 × 400), which are never enlarged.
 */
const DEVIL_FRUIT_IMAGE = {
  width: 320,
  height: 400,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 5,
};

/**
 * The Devil Fruit: one romaji, the type it belongs to, and a name, a description, advantages
 * and disadvantages per language - the longest each may be is what the backend accepts.
 * The type is a relation: a draft may not have chosen one, but review asks for it. The image
 * is optional.
 */
export const DEVIL_FRUIT: EntityDefinition = {
  entityType: 'DEVIL_FRUIT',
  route: '/content/devil-fruits',
  api: '/api/content/devil-fruits',
  i18n: 'content.devilFruits',
  icon: 'assets/devil-fruit.webp',
  fields: [
    textField('romaji', { maxLength: 100 }),
    imageField('image', DEVIL_FRUIT_IMAGE),
    relationField('type', { target: 'DEVIL_FRUIT_TYPE' }),
    localizedTextField('name', { maxLength: 100 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
    localizedTextField('advantages', { maxLength: 2000, rows: 5 }),
    localizedTextField('disadvantages', { maxLength: 2000, rows: 5 }),
  ],
};
