import {
  localizedTextField,
  numberField,
  relatedList,
  relationField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Arc: a number, the saga it belongs to (asked for by review) and, per language, a title
 * and a description. Chapters and episodes point to it: its card lists a few of each.
 */
export const ARC: EntityDefinition = {
  entityType: 'ARC',
  naturalKey: 'number',
  labelField: 'title',
  route: '/content/arcs',
  api: '/api/content/arcs',
  i18n: 'content.arcs',
  icon: '◐',
  fields: [
    numberField('number'),
    relationField('saga', { target: 'SAGA' }),
    localizedTextField('title', { maxLength: 200 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
  ],
  sections: [relatedList({ of: 'CHAPTER', by: 'arc' }), relatedList({ of: 'EPISODE', by: 'arc' })],
};
