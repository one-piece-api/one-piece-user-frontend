import {
  paragraphListField,
  localizedTextField,
  numberField,
  relatedList,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Saga: a number, a title per language and a description in paragraphs. Arcs point to it: its card lists a few.
 */
export const SAGA: EntityDefinition = {
  entityType: 'SAGA',
  naturalKey: 'number',
  readerPreview: true,
  labelField: 'title',
  route: '/content/sagas',
  api: '/api/content/sagas',
  i18n: 'content.sagas',
  icon: '☰',
  fields: [
    numberField('number'),
    localizedTextField('title', { maxLength: 200 }),
    paragraphListField('description', { rows: 5 }),
  ],
  sections: [relatedList({ of: 'ARC', by: 'saga' })],
};
