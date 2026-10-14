import {
  localizedTextField,
  numberField,
  relationField,
  releaseListField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Episode: a number, the arc it belongs to (optional: a filler has none) and, per
 * language, a title and a description; optionally its Japanese title and broadcast dates per
 * country.
 */
export const EPISODE: EntityDefinition = {
  entityType: 'EPISODE',
  naturalKey: 'number',
  labelField: 'title',
  route: '/content/episodes',
  api: '/api/content/episodes',
  i18n: 'content.episodes',
  icon: '▶',
  fields: [
    numberField('number'),
    relationField('arc', { target: 'ARC', optional: true }),
    localizedTextField('title', { maxLength: 200 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
    textField('japaneseTitle', { maxLength: 200, optional: true, lang: 'ja' }),
    releaseListField('broadcasts'),
  ],
};
