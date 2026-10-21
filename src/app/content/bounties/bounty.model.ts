import { formatBerry } from '../berry';
import {
  badgeColumn,
  badgeField,
  berryColumn,
  booleanField,
  chainSection,
  choiceField,
  choiceFilter,
  imageField,
  localizedTextField,
  numberField,
  relationField,
  storyPointField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * What the poster of a bounty must be - the backend's profile `bounty`: at least 560 × 800 and
 * close to 7:10, a PNG of any background, at most 5 MB and 25 megapixels. The backend fits it
 * into a 420 × 600 canvas.
 */
const BOUNTY_POSTER = {
  width: 420,
  height: 600,
  minWidth: 560,
  minHeight: 800,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 0,
};

const CONDITIONS = ['DEAD_OR_ALIVE', 'ONLY_ALIVE'] as const;
const VALIDITIES = ['ACTIVE', 'SUPERSEDED', 'INACTIVE'] as const;

/**
 * "Monkey D. Luffy — 3.000.000.000 ฿": the poster name and the amount, in the reader's way of
 * writing numbers - for a version, and for a reference to a bounty, which carries both.
 */
function bountyLabel(body: Readonly<Record<string, unknown>>, language: string): string | null {
  const posterName = typeof body['posterName'] === 'string' ? body['posterName'].trim() : '';
  const amount = typeof body['amount'] === 'number' ? formatBerry(body['amount'], language) : '';
  return [posterName, amount].filter(Boolean).join(' — ') || null;
}

/**
 * The Bounty: one wanted poster (plan D1), known by its poster name and amount together (D2).
 * It may replace an earlier bounty (`previous`); its validity is worked out by the backend
 * (D3) and its chain - newest first, itself included - comes with every version.
 */
export const BOUNTY: EntityDefinition = {
  entityType: 'BOUNTY',
  naturalKey: ['posterName', 'amount'],
  label: bountyLabel,
  route: '/content/bounties',
  api: '/api/content/bounties',
  i18n: 'content.bounties',
  icon: '฿',
  fields: [
    textField('posterName', { maxLength: 100 }),
    numberField('amount'),
    imageField('image', BOUNTY_POSTER),
    choiceField('condition', { options: CONDITIONS }),
    booleanField('inactive', { inCard: false }),
    badgeField('validity', {
      options: VALIDITIES,
      tones: { ACTIVE: 'PUBLISHED', SUPERSEDED: 'IN_REVIEW', INACTIVE: 'REJECTED' },
    }),
    relationField('previous', { target: 'BOUNTY', optional: true, listed: false }),
    relationField('holder', { target: 'CHARACTER', optional: true }),
    storyPointField('firstAppearance'),
    localizedTextField('description', { maxLength: 2000, rows: 8 }),
  ],
  sections: [chainSection('chain')],
  list: {
    nameField: 'posterName',
    ownSearchPlaceholder: true,
    columns: [berryColumn('amount', { sortable: true }), badgeColumn('validity')],
    filters: [choiceFilter('validity', VALIDITIES), choiceFilter('condition', CONDITIONS)],
  },
};
