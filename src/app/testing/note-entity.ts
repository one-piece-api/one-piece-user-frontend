import {
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
