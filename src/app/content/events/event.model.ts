import {
  eventTimeField,
  localizedTextField,
  relationListField,
  storyPointField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Event: what happens in the world of One Piece and when the reader finds out. No natural
 * key - two events may share a title - so it is known by its id. When it occurs is a chapter
 * or a year before the story; a long event also ends; it is revealed, unless told otherwise,
 * in the chapter it occurs in; the Devil Fruits taking part are a list. Written in a dialog
 * over the list or the page it is opened from.
 */
export const EVENT: EntityDefinition = {
  entityType: 'EVENT',
  route: '/content/events',
  api: '/api/content/events',
  i18n: 'content.events',
  icon: '⚑',
  labelField: 'title',
  editor: 'dialog',
  fields: [
    eventTimeField('occursAt'),
    eventTimeField('endsAt', { optional: true, notBefore: 'occursAt' }),
    storyPointField('revealedAt', { optional: true, defaultsTo: 'occursAt' }),
    relationListField('participants', { part: 'devilFruits', target: 'DEVIL_FRUIT' }),
    localizedTextField('title', { maxLength: 200 }),
    localizedTextField('description', { maxLength: 2000, rows: 6, optional: true }),
  ],
};
