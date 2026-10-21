import {
  booleanField,
  choiceField,
  localizedTextField,
  monthDayField,
  partListField,
  relationField,
  textField,
  type EntityDefinition,
} from '../content/entity/entity-definition';
import type { EntityReference } from '../content/entity/entity-reference';

/**
 * An entity made up for the specs of the `partList` and `monthDay` kinds, with one list of
 * each shape: bare references (species), bare texts (aliases), a localized part (epithets)
 * and several parts (memberships). Its i18n keys do not exist: the specs look at values.
 */
export const PEOPLE: EntityDefinition = {
  entityType: 'PERSON',
  route: '/content/people',
  api: '/api/content/people',
  i18n: 'content.people',
  icon: '',
  labelField: 'name',
  naturalKey: 'romaji',
  fields: [
    textField('romaji', { maxLength: 100 }),
    monthDayField('birthday'),
    partListField('species', {
      parts: [relationField('species', { target: 'SPECIES' })],
      unique: 'species',
    }),
    localizedTextField('name', { maxLength: 100 }),
    partListField('epithets', {
      parts: [localizedTextField('text', { maxLength: 100 })],
      maxEntries: 3,
    }),
    partListField('aliases', {
      parts: [textField('alias', { maxLength: 100 })],
      maxEntries: 20,
      unique: 'alias',
    }),
    partListField('memberships', {
      parts: [
        relationField('affiliation', { target: 'AFFILIATION' }),
        localizedTextField('role', { maxLength: 100, optional: true }),
        choiceField('rank', { options: ['ADMIRAL', 'CAPTAIN'] }),
        booleanField('former'),
      ],
      unique: 'affiliation',
    }),
  ],
};

export const HUMAN: EntityReference = {
  id: 's1',
  romaji: 'Ningen',
  names: { it: 'Umano', en: 'Human' },
};
export const GIANT: EntityReference = {
  id: 's2',
  romaji: 'Kyojin',
  names: { it: 'Gigante', en: 'Giant' },
};
export const NAVY: EntityReference = { id: 'a1', romaji: 'Kaigun', names: { en: 'Navy' } };
