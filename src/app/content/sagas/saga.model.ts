import {
  localizedTextField,
  numberField,
  relatedList,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Saga: a number and, per language, a title and a description - the longest each may be
 * is what the backend accepts. Arcs point to it: its card lists a few.
 */
export const SAGA: EntityDefinition = {
  entityType: 'SAGA',
  naturalKey: 'number',
  labelField: 'title',
  route: '/content/sagas',
  api: '/api/content/sagas',
  i18n: 'content.sagas',
  icon: '☰',
  fields: [
    numberField('number'),
    localizedTextField('title', { maxLength: 200 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
  ],
  sections: [relatedList({ of: 'ARC', by: 'saga' })],
};
