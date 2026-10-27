import {
  choiceField,
  choiceFilter,
  countColumn,
  imageField,
  localizedTextField,
  storyPointField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * What the flag of an affiliation must be - the backend's profile `affiliation`: at least
 * 512 × 384 and close to 4:3, a PNG or WebP, at most 5 MB and 25 megapixels, with no transparency
 * required. The backend fits it, centred and never cropped or enlarged, into a 400 × 300 canvas.
 */
const AFFILIATION_FLAG = {
  width: 400,
  height: 300,
  minWidth: 512,
  minHeight: 384,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 0,
};

/** What sort of group an affiliation is (plan D10); a Navy one is the only that gives its members a rank. */
export const AFFILIATION_KINDS = [
  'PIRATE_CREW',
  'NAVY',
  'WORLD_GOVERNMENT',
  'REVOLUTIONARY_ARMY',
  'OTHER',
] as const;

/**
 * The Affiliation: a group a character can belong to, of any kind - a pirate crew, the Navy,
 * the World Government (plan D1). One romaji, a name and a description per language (D2, D3),
 * the kind (C5), the first appearance (D4) and, optionally, its flag (D5).
 */
export const AFFILIATION: EntityDefinition = {
  entityType: 'AFFILIATION',
  naturalKey: 'romaji',
  route: '/content/affiliations',
  api: '/api/content/affiliations',
  i18n: 'content.affiliations',
  icon: 'assets/crews.webp',
  labelField: 'name',
  fields: [
    textField('romaji', { maxLength: 100 }),
    choiceField('kind', { options: AFFILIATION_KINDS }),
    imageField('image', AFFILIATION_FLAG, { hint: 'content.affiliations.imageHint' }),
    storyPointField('firstAppearance'),
    localizedTextField('name', { maxLength: 100 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
  ],
  // Its members: derived from the characters naming it, never part of its version (D10, D16).
  counts: [countColumn('memberCount', { of: 'CHARACTER', by: 'affiliation' })],
  // The kind has no column: the rows carry only names and romaji, as the character's status.
  list: { filters: [choiceFilter('kind', AFFILIATION_KINDS)] },
};
