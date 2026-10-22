import { AFFILIATION_KINDS } from '../affiliations/affiliation.model';
import {
  booleanField,
  choiceField,
  choiceFilter,
  imageField,
  localizedTextField,
  monthDayField,
  partListField,
  relationField,
  storyPointField,
  textField,
  countColumn,
  relatedList,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * What the portrait of a character must be - the backend's profile `character`: at least
 * 400 × 500 and close to 4:5, a PNG with no transparency required, at most 5 MB and 25
 * megapixels. The backend fits it into a 320 × 400 canvas.
 */
const CHARACTER_PORTRAIT = {
  width: 320,
  height: 400,
  minWidth: 400,
  minHeight: 500,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 0,
};

/** Whether the character is alive, as the story last told it (plan D4). */
const STATUSES = ['ALIVE', 'DECEASED', 'UNKNOWN'] as const;
const GENDERS = ['MALE', 'FEMALE', 'UNKNOWN'] as const;

/** The ranks of the Navy, highest first - the backend's `MarineRank` (plan D10). */
const MARINE_RANKS = [
  'FLEET_ADMIRAL',
  'ADMIRAL',
  'VICE_ADMIRAL',
  'REAR_ADMIRAL',
  'COMMODORE',
  'CAPTAIN',
  'COMMANDER',
  'LIEUTENANT_COMMANDER',
  'LIEUTENANT',
  'LIEUTENANT_JUNIOR_GRADE',
  'ENSIGN',
  'WARRANT_OFFICER',
  'MASTER_CHIEF_PETTY_OFFICER',
  'CHIEF_PETTY_OFFICER',
  'PETTY_OFFICER',
  'SEAMAN_FIRST_CLASS',
  'SEAMAN_APPRENTICE',
  'SEAMAN_RECRUIT',
  'CHORE_BOY',
] as const;

/** The most epithets and aliases a character has - the backend's limits. */
const MAX_EPITHETS = 20;
const MAX_ALIASES = 20;

/**
 * The Character: a person of the story, known by the romaji of its official name (plan D2).
 * Besides the name and the description per language, its epithets - a title written in each
 * language - and aliases - names it goes by, the same in every language - as ordered lists
 * (D15), the species it belongs to (D8) and a birthday without a year (D16).
 */
export const CHARACTER: EntityDefinition = {
  entityType: 'CHARACTER',
  naturalKey: 'romaji',
  route: '/content/characters',
  api: '/api/content/characters',
  i18n: 'content.characters',
  icon: 'assets/characters.webp',
  labelField: 'name',
  fields: [
    textField('romaji', { maxLength: 100 }),
    textField('japaneseName', { maxLength: 100, optional: true, lang: 'ja' }),
    imageField('image', CHARACTER_PORTRAIT, { hint: 'content.characters.imageHint' }),
    choiceField('status', { options: STATUSES }),
    choiceField('gender', { options: GENDERS }),
    monthDayField('birthday'),
    partListField('species', {
      parts: [relationField('species', { target: 'SPECIES' })],
      unique: 'species',
    }),
    // A rank only where the affiliation is the Navy; the backend refuses it elsewhere (D10).
    partListField('affiliations', {
      parts: [
        relationField('affiliation', { target: 'AFFILIATION' }),
        localizedTextField('role', { maxLength: 100, optional: true }),
        choiceField('marineRank', {
          options: MARINE_RANKS,
          visibleWhen: { part: 'affiliation', field: 'kind', equals: 'NAVY' },
        }),
        booleanField('former'),
      ],
      unique: 'affiliation',
      filterBy: { key: 'affiliation', part: 'affiliation' },
    }),
    storyPointField('firstAppearance'),
    localizedTextField('name', { maxLength: 100 }),
    partListField('epithets', {
      parts: [localizedTextField('text', { maxLength: 100 })],
      maxEntries: MAX_EPITHETS,
    }),
    partListField('aliases', {
      parts: [textField('alias', { maxLength: 100 })],
      maxEntries: MAX_ALIASES,
      unique: 'alias',
    }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
  ],
  // The bounties it holds: derived from the bounties naming it, never part of its version (D11).
  counts: [countColumn('bountyCount', { of: 'BOUNTY', by: 'holder' })],
  sections: [relatedList({ of: 'BOUNTY', by: 'holder' })],
  list: {
    // The status has no column: the rows carry only names and romaji (plan C3, decision 4a).
    filters: [
      choiceFilter('characterStatus', STATUSES, { field: 'status' }),
      choiceFilter('affiliationKind', AFFILIATION_KINDS),
    ],
  },
};
