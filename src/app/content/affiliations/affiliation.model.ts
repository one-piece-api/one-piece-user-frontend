import {
  imageField,
  localizedTextField,
  storyPointField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * What the emblem of an affiliation must be - the backend's profile `affiliation`: at least
 * 512 × 512 and close to square, a PNG with at least 5 % of it transparent, at most 5 MB and
 * 25 megapixels. The backend fits it into a 400 × 400 transparent canvas.
 */
const AFFILIATION_EMBLEM = {
  width: 400,
  height: 400,
  minWidth: 512,
  minHeight: 512,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 5,
};

/**
 * The Affiliation: a group a character can belong to, of any kind - a pirate crew, the Navy,
 * the World Government (plan D1). One romaji, a name and a description per language (D2, D3),
 * the first appearance (D4) and, optionally, its emblem (D5).
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
    imageField('image', AFFILIATION_EMBLEM, { hint: 'content.affiliations.imageHint' }),
    storyPointField('firstAppearance'),
    localizedTextField('name', { maxLength: 100 }),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
  ],
};
