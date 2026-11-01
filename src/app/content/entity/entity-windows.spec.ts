import {
  CHAPTER_1,
  CHAPTER_8,
  CREW,
  CREWMATES,
  EPISODE_1,
  NAVY,
} from '../../testing/part-list-entity';
import {
  COUNT_PART,
  diffBodies,
  draftFieldKey,
  draftOf,
  readinessChecks,
  toBody,
  type EntityBody,
  type EntityDraft,
} from './entity-body';
import type { PartListField } from './entity-definition';
import { isBareList, isFormer, partAtPath, partsOf, type PartEntryDraft } from './entity-part-list';
import { draftEntryPath } from './field-kinds';
import { POINT_REFUSED_KEY, pointRefusalKey } from './point-refusals';

const LANGUAGES = ['it', 'en'];

function list(key: string): PartListField {
  const field = CREWMATES.fields.find((candidate) => candidate.key === key);
  if (field?.kind !== 'partList') {
    throw new Error(`no list ${key}`);
  }
  return field;
}

const ALIASES = list('aliases');
const MEMBERSHIPS = list('memberships');
const PERIODS = MEMBERSHIPS.parts[1] as PartListField;

/** Usopp as the API sends him: a crew left once and joined again, points as numbered references. */
const USOPP: EntityBody = {
  romaji: 'Usopp',
  firstAppearance: { chapter: CHAPTER_1, episode: EPISODE_1 },
  aliases: [{ alias: 'Sogeking', discovered: { chapter: CHAPTER_8 }, ended: null }],
  memberships: [
    {
      affiliation: CREW,
      periods: [
        {
          role: { en: 'Sniper' },
          discovered: { chapter: CHAPTER_1 },
          ended: { chapter: CHAPTER_8, episode: EPISODE_1 },
        },
        { role: { en: 'Sniper' }, discovered: { chapter: CHAPTER_8 }, ended: null },
      ],
    },
  ],
  translations: { it: { name: 'Usopp' }, en: { name: 'Usopp' } },
};

function entries(draft: EntityDraft, key: string): PartEntryDraft[] {
  return draft[key] as PartEntryDraft[];
}

describe('a windowed list', () => {
  it('gives every entry a discovered and an optional ended after its own parts', () => {
    expect(partsOf(ALIASES).map(({ key, kind }) => `${key}:${kind}`)).toEqual([
      'alias:text',
      'discovered:storyPoint',
      'ended:storyPoint',
    ]);
    expect(partsOf(ALIASES)[2]).toMatchObject({ optional: true });
    // A list of one part travels as objects once it has a window: { alias, discovered, ended }.
    expect(isBareList(ALIASES)).toBe(false);
  });

  it('sends each point by the ids of its chapter and episode, an empty period left out', () => {
    const draft = draftOf(CREWMATES, USOPP, LANGUAGES);
    const membership = entries(draft, 'memberships')[0];
    const periods = membership.values['periods'] as PartEntryDraft[];
    const withEmpty = {
      ...draft,
      memberships: [
        {
          ...membership,
          values: { ...membership.values, periods: [{ key: 'empty', values: {} }, ...periods] },
        },
      ],
    };

    const body = toBody(CREWMATES, withEmpty);

    // A point leaves the axis it does not have as null, and an end not written as null.
    expect(body['aliases']).toEqual([
      { alias: 'Sogeking', discovered: { chapter: 'ch8', episode: null }, ended: null },
    ]);
    expect(body['memberships']).toEqual([
      {
        affiliation: 'a2',
        periods: [
          {
            role: { en: 'Sniper' },
            rank: null,
            discovered: { chapter: 'ch1', episode: null },
            ended: { chapter: 'ch8', episode: 'ep1' },
          },
          {
            role: { en: 'Sniper' },
            rank: null,
            discovered: { chapter: 'ch8', episode: null },
            ended: null,
          },
        ],
      },
    ]);
  });

  it('makes an entry former by its end, a membership only when every period has ended', () => {
    const [sogeking] = USOPP['aliases'] as unknown[];
    const [crew] = USOPP['memberships'] as Record<string, unknown[]>[];
    const [first] = crew['periods'];

    expect(isFormer(ALIASES, sogeking)).toBe(false);
    expect(isFormer(ALIASES, { alias: 'Sogeking', ended: { chapter: CHAPTER_8 } })).toBe(true);
    expect(isFormer(MEMBERSHIPS, crew)).toBe(false);
    expect(isFormer(MEMBERSHIPS, { affiliation: CREW, periods: [first] })).toBe(true);
    // A membership with no period is not former: it is incomplete.
    expect(isFormer(MEMBERSHIPS, { affiliation: CREW, periods: [] })).toBe(false);
  });

  it('places an error down to the point of a period, past the empty entries not sent', () => {
    const draft = draftOf(CREWMATES, USOPP, LANGUAGES);
    const withEmpty = {
      ...draft,
      memberships: [{ key: 'empty', values: {} }, ...entries(draft, 'memberships')],
    };

    expect(draftFieldKey(CREWMATES, 'memberships[0].periods[1].discovered.episode')).toBe(
      'memberships.0.periods.1.discovered.episode',
    );
    expect(draftFieldKey(CREWMATES, 'memberships[0].periods[1]')).toBe('memberships.0.periods.1');
    expect(draftFieldKey(CREWMATES, 'aliases[0].ended.chapter')).toBe('aliases.0.ended.chapter');
    expect(draftFieldKey(CREWMATES, 'memberships[0].periods[1].nothing')).toBeNull();
    expect(partAtPath(MEMBERSHIPS, ['periods', '1', 'rank'])).toEqual({
      list: PERIODS,
      part: PERIODS.parts[1],
    });
    // The JSON sent left the empty membership out: its first entry is the editor's second.
    expect(
      draftEntryPath(MEMBERSHIPS, withEmpty.memberships, ['0', 'periods', '1', 'discovered']),
    ).toEqual(['1', 'periods', '1', 'discovered']);
    expect(draftEntryPath(MEMBERSHIPS, withEmpty.memberships, ['1'])).toBeNull();
  });

  it('asks review for the discovered of every entry and at least one period of every membership', () => {
    const draft = draftOf(
      CREWMATES,
      {
        ...USOPP,
        aliases: [{ alias: 'Sogeking' }],
        memberships: [
          { affiliation: NAVY, periods: [] },
          { affiliation: CREW, periods: [{ role: { en: 'Sniper' } }] },
        ],
      },
      LANGUAGES,
    );

    const checks = readinessChecks(CREWMATES, draft, LANGUAGES)
      .filter(({ entry }) => entry)
      .map(({ field, entry, done }) => [
        field,
        entry?.position,
        entry?.part,
        entry?.subPosition,
        done,
      ]);

    expect(checks).toEqual([
      ['aliases', 1, 'discovered', undefined, false],
      ['memberships', 1, `periods.${COUNT_PART}`, undefined, false],
      ['memberships', 2, `periods.${COUNT_PART}`, undefined, true],
      ['memberships', 2, 'periods.discovered', 1, false],
    ]);
  });

  it('compares the windows and the periods, a period by its place', () => {
    const after: EntityBody = {
      ...USOPP,
      memberships: [
        {
          affiliation: CREW,
          periods: [
            (USOPP['memberships'] as Record<string, unknown[]>[])[0]['periods'][0],
            { role: { en: 'King of Snipers' }, discovered: { chapter: CHAPTER_8 }, ended: null },
          ],
        },
      ],
      aliases: [
        { alias: 'Sogeking', discovered: { chapter: CHAPTER_8 }, ended: { chapter: CHAPTER_8 } },
      ],
    };

    const diffs = diffBodies(CREWMATES, USOPP, after, LANGUAGES)
      .filter(({ change }) => change !== 'UNCHANGED')
      .map(({ field: ref }) => [
        ref.field,
        ref.entry?.position,
        ref.entry?.part,
        ref.entry?.subPosition,
        ref.language,
        ref.entry?.storyPoint,
      ]);

    expect(diffs).toEqual([
      ['aliases', 1, 'ended', undefined, null, true],
      ['memberships', 1, 'periods.role', 2, 'en', undefined],
    ]);
  });
});

describe('the words of a point refused', () => {
  it.each([
    ['must be on an axis of the first appearance', 'offAxis'],
    ['must not be before the first appearance', 'beforeFirstAppearance'],
    ['must be on an axis where discovered has a part', 'endedOffAxis'],
    ['must not be before discovered', 'endedBeforeDiscovered'],
    ['must not start before a previous period on the chapter axis', 'periodOutOfOrder'],
    ['must not overlap a previous period on the episode axis', 'periodOverlapping'],
    ['must have an end: only the last period may have none', 'periodOpen'],
    ['must be a Chapter with an approved version', 'notLinkable'],
    ['must be an Episode with an approved version', 'notLinkable'],
    ['must be a Chapter', 'unknown'],
    ['must be an Episode', 'unknown'],
  ])('match the backend saying "%s"', (message, key) => {
    expect(pointRefusalKey(message)).toBe(`content.storyPoint.refused.${key}`);
  });

  it('fall back to a generic text, never to English, for one not known', () => {
    expect(pointRefusalKey('must be something new')).toBe(POINT_REFUSED_KEY);
    expect(pointRefusalKey(null)).toBe(POINT_REFUSED_KEY);
  });
});
