import {
  imageField,
  localizedTextField,
  relationField,
  textField,
  type EntityDefinition,
} from '../content/entity/entity-definition';

/**
 * An entity that exists only in the specs, unlike the Devil Fruit Type in everything: a
 * second shared field after the translated ones, other keys, other limits, one long text.
 * Whatever of the type is left in the generic pages shows up as a failure here.
 */
export const NOTE: EntityDefinition = {
  entityType: 'NOTE',
  route: '/content/notes',
  api: '/api/content/notes',
  i18n: 'content.notes',
  icon: '✎',
  fields: [
    textField('romaji', { maxLength: 40 }),
    localizedTextField('name', { maxLength: 60 }),
    localizedTextField('body', { maxLength: 500, rows: 4, layout: 'wide' }),
    textField('code', { maxLength: 8 }),
  ],
};

/** The same note, filed in a folder: one field that points to another content. */
export const NOTE_IN_FOLDER: EntityDefinition = {
  ...NOTE,
  fields: [...NOTE.fields, relationField('folder', { target: 'FOLDER' })],
};

/**
 * The same note with a picture: another key and another profile than the Devil Fruit's -
 * twice as wide as high, and small - so nothing of the fruit's image is taken for granted.
 */
export const NOTE_WITH_PICTURE: EntityDefinition = {
  ...NOTE,
  fields: [
    ...NOTE.fields,
    imageField('picture', {
      width: 40,
      height: 20,
      ratioTolerance: 0.1,
      maxBytes: 1000,
      maxPixels: 10_000,
      minTransparentPercent: 10,
    }),
  ],
};
