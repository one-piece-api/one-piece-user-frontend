import {
  localizedTextField,
  numberField,
  relationField,
  releaseListField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * The Chapter: a number, the arc it belongs to (asked for by review), the volume that
 * collects it (optional) and, per language, a title and a description; optionally its
 * Japanese title, page count and release dates per country.
 */
export const CHAPTER: EntityDefinition = {
  entityType: 'CHAPTER',
  naturalKey: 'number',
  labelField: 'title',
  route: '/content/chapters',
  api: '/api/content/chapters',
  i18n: 'content.chapters',
  icon: '¶',
  fields: [
    numberField('number'),
    relationField('arc', { target: 'ARC' }),
    relationField('volume', { target: 'VOLUME', optional: true }),
    localizedTextField('title', { maxLength: 200 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
    textField('japaneseTitle', { maxLength: 200, optional: true, lang: 'ja' }),
    numberField('pageCount', { min: 1, optional: true }),
    releaseListField('releases'),
  ],
};
