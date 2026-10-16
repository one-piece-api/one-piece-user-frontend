import {
  eventTimeField,
  imageField,
  localizedTextField,
  relationField,
  relationListField,
  storyPointField,
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
  naturalKey: 'romaji',
  route: '/content/notes',
  api: '/api/content/notes',
  i18n: 'content.notes',
  icon: '✎',
  labelField: 'name',
  fields: [
    textField('romaji', { maxLength: 40 }),
    localizedTextField('name', { maxLength: 60 }),
    localizedTextField('body', { maxLength: 500, rows: 4 }),
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

/**
 * The same note on the world's axis: when it happens and, for a long one, until when - the
 * end never before the start.
 */
export const NOTE_ON_TIMELINE: EntityDefinition = {
  ...NOTE,
  fields: [
    ...NOTE.fields,
    eventTimeField('occursAt'),
    eventTimeField('endsAt', { optional: true, notBefore: 'occursAt' }),
  ],
};

/** The same note, written in a dialog over the page it is opened from. */
export const NOTE_IN_DIALOG: EntityDefinition = { ...NOTE, editor: 'dialog' };

/** A note told apart by its id alone: no natural key, as an event. */
export const NOTE_WITHOUT_KEY: EntityDefinition = {
  ...NOTE,
  naturalKey: undefined,
  fields: NOTE.fields.filter(({ key }) => key !== 'romaji'),
};

/** A note with the Devil Fruits it is about: a list of contents, sent as `{ devilFruits: [ids] }`. */
export const NOTE_WITH_PARTICIPANTS: EntityDefinition = {
  ...NOTE,
  fields: [
    ...NOTE.fields,
    relationListField('participants', { part: 'devilFruits', target: 'DEVIL_FRUIT' }),
  ],
};

/** A note on the timeline, revealed by default in the chapter it occurs in, as an event. */
export const NOTE_REVEALED: EntityDefinition = {
  ...NOTE_ON_TIMELINE,
  fields: [
    ...NOTE_ON_TIMELINE.fields,
    storyPointField('revealedAt', { optional: true, defaultsTo: 'occursAt' }),
  ],
};
