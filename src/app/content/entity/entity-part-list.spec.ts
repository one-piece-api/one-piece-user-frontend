import { GIANT, HUMAN, NAVY, PEOPLE } from '../../testing/part-list-entity';
import {
  diffBodies,
  draftFieldKey,
  draftOf,
  isLanguageComplete,
  readinessChecks,
  toBody,
  type EntityBody,
} from './entity-body';
import type { PartListField } from './entity-definition';
import { identityOf, isBareList, type PartEntryDraft } from './entity-part-list';
import { FIELD_KINDS } from './field-kinds';

const LANGUAGES = ['it', 'en'];

function list(key: string): PartListField {
  const field = PEOPLE.fields.find((candidate) => candidate.key === key);
  if (field?.kind !== 'partList') {
    throw new Error(`no list ${key}`);
  }
  return field;
}

const SPECIES = list('species');
const EPITHETS = list('epithets');
const ALIASES = list('aliases');
const MEMBERSHIPS = list('memberships');

/** A character as the API sends it, complete in both languages. */
const NAMI: EntityBody = {
  romaji: 'Nami',
  birthday: '--07-03',
  species: [HUMAN],
  epithets: [{ text: { it: 'Gatta ladra', en: 'Cat Burglar' } }],
  aliases: ['Miss Nami'],
  memberships: [{ affiliation: NAVY, role: { en: 'Spy' }, rank: 'CAPTAIN', former: true }],
  translations: { it: { name: 'Nami' }, en: { name: 'Nami' } },
};

function entry(values: Record<string, unknown>): PartEntryDraft {
  return { key: `k-${JSON.stringify(values)}`, values };
}

describe('the partList field kind', () => {
  const strategy = FIELD_KINDS.partList;

  it('is kept on the version, and review never asks for a list as a whole', () => {
    expect(strategy.localized).toBe(false);
    expect(strategy.forReview).toBe(false);
  });

  it('sends a list of one part not localized as bare values, any other as objects', () => {
    expect(isBareList(SPECIES)).toBe(true);
    expect(isBareList(ALIASES)).toBe(true);
    expect(isBareList(EPITHETS)).toBe(false);
    expect(isBareList(MEMBERSHIPS)).toBe(false);
  });

  it('gives the editor each entry with a key and each part as its kind holds it', () => {
    const draft = draftOf(PEOPLE, NAMI, LANGUAGES);

    expect((draft['species'] as PartEntryDraft[]).map(({ values }) => values)).toEqual([
      { species: HUMAN },
    ]);
    expect((draft['aliases'] as PartEntryDraft[]).map(({ values }) => values)).toEqual([
      { alias: 'Miss Nami' },
    ]);
    expect((draft['epithets'] as PartEntryDraft[]).map(({ values }) => values)).toEqual([
      { text: { it: 'Gatta ladra', en: 'Cat Burglar' } },
    ]);
    expect((draft['memberships'] as PartEntryDraft[])[0].values).toEqual({
      affiliation: NAVY,
      role: { en: 'Spy' },
      rank: 'CAPTAIN',
      former: true,
    });
    expect(new Set((draft['species'] as PartEntryDraft[]).map(({ key }) => key)).size).toBe(1);
  });

  it('saves what the API reads back: ids for references, objects keyed by part', () => {
    const body = toBody(PEOPLE, draftOf(PEOPLE, NAMI, LANGUAGES));

    expect(body['species']).toEqual(['s1']);
    expect(body['aliases']).toEqual(['Miss Nami']);
    expect(body['epithets']).toEqual([{ text: { it: 'Gatta ladra', en: 'Cat Burglar' } }]);
    expect(body['memberships']).toEqual([
      { affiliation: 'a1', role: { en: 'Spy' }, rank: 'CAPTAIN', former: true },
    ]);
  });

  it('saves the texts trimmed, leaves out a blank language, and drops an entry left empty', () => {
    expect(
      strategy.savedValue(
        [
          entry({ text: { it: '  Gatta ladra ', en: '   ' } }),
          entry({ text: { it: ' ', en: '' } }),
          entry({}),
        ],
        EPITHETS,
      ),
    ).toEqual([{ text: { it: 'Gatta ladra' } }]);
    expect(
      strategy.savedValue([entry({ alias: '  ' }), entry({ alias: ' Sogeking ' })], ALIASES),
    ).toEqual(['Sogeking']);
    expect(strategy.savedValue([entry({ species: null })], SPECIES)).toEqual([]);
  });

  it('does not keep an entry whose only value is a flag: alone it says nothing', () => {
    expect(strategy.savedValue([entry({ former: true })], MEMBERSHIPS)).toEqual([]);
  });

  it('gives the editor and the JSON an empty list for a value never written', () => {
    expect(strategy.draftValue(undefined, SPECIES)).toEqual([]);
    expect(strategy.savedValue(undefined, SPECIES)).toEqual([]);
  });
});

describe('what identifies an entry', () => {
  it('is its unique part: the id of a content, a text whatever its case', () => {
    expect(identityOf(SPECIES, HUMAN)).toBe('s1');
    expect(identityOf(ALIASES, ' Sogeking ')).toBe('sogeking');
    expect(identityOf(ALIASES, entry({ alias: 'SOGEKING' }))).toBe('sogeking');
    expect(identityOf(MEMBERSHIPS, { affiliation: NAVY })).toBe('a1');
  });

  it('is nothing for a list without a unique part, or an entry without a value there', () => {
    expect(identityOf(EPITHETS, { text: { it: 'x' } })).toBeNull();
    expect(identityOf(ALIASES, '  ')).toBeNull();
  });
});

describe('the readiness of a list with a localized part', () => {
  it('asks for every entry in every language, as the backend does before review', () => {
    const draft = draftOf(
      PEOPLE,
      { ...NAMI, epithets: [{ text: { it: 'Gatta ladra' } }, { text: { it: 'Navigatrice' } }] },
      LANGUAGES,
    );

    const epithets = readinessChecks(PEOPLE, draft, LANGUAGES).filter(
      ({ field }) => field === 'epithets',
    );

    expect(
      epithets.map(({ language, entry, done }) => [language, entry?.position, entry?.part, done]),
    ).toEqual([
      ['it', 1, 'text', true],
      ['it', 2, 'text', true],
      ['en', 1, 'text', false],
      ['en', 2, 'text', false],
    ]);
  });

  it('does not ask for an entry added and left empty: it is not saved', () => {
    const draft = draftOf(PEOPLE, NAMI, LANGUAGES);
    draft['epithets'] = [...(draft['epithets'] as PartEntryDraft[]), entry({})];

    expect(
      readinessChecks(PEOPLE, draft, LANGUAGES).filter(({ field }) => field === 'epithets'),
    ).toHaveLength(2);
  });

  it('leaves a language incomplete while an entry lacks it - saved or being written', () => {
    const halfway = { ...NAMI, epithets: [{ text: { it: 'Gatta ladra' } }] };

    expect(isLanguageComplete(PEOPLE, halfway, 'it')).toBe(true);
    expect(isLanguageComplete(PEOPLE, halfway, 'en')).toBe(false);
    expect(isLanguageComplete(PEOPLE, draftOf(PEOPLE, halfway, LANGUAGES), 'en')).toBe(false);
  });

  it('never asks for an optional localized part, nor for parts that are not localized', () => {
    const checks = readinessChecks(PEOPLE, draftOf(PEOPLE, NAMI, LANGUAGES), LANGUAGES);

    expect(checks.some(({ field }) => field === 'memberships')).toBe(false);
    expect(checks.some(({ field }) => field === 'species' || field === 'aliases')).toBe(false);
  });
});

describe('where the backend says an entry is at fault', () => {
  it('is the entry, its part, or its part in one language', () => {
    expect(draftFieldKey(PEOPLE, 'species[1]')).toBe('species.1');
    expect(draftFieldKey(PEOPLE, 'aliases[0]')).toBe('aliases.0');
    expect(draftFieldKey(PEOPLE, 'epithets[1].text[en]')).toBe('epithets.1.text.en');
    expect(draftFieldKey(PEOPLE, 'memberships[0].rank')).toBe('memberships.0.rank');
  });

  it('is the list itself for a list refused as a whole', () => {
    expect(draftFieldKey(PEOPLE, 'epithets')).toBe('epithets');
  });

  it('is nothing for a part or a list the entity does not have', () => {
    expect(draftFieldKey(PEOPLE, 'memberships[0].title')).toBeNull();
    expect(draftFieldKey(PEOPLE, 'relatives[0]')).toBeNull();
  });
});

describe('comparing two versions of a list of parts', () => {
  function rows(field: string, before: Partial<EntityBody>, after: Partial<EntityBody>) {
    return diffBodies(
      PEOPLE,
      { translations: {}, ...before },
      { translations: {}, ...after },
      LANGUAGES,
    )
      .filter((diff) => diff.field.field === field)
      .map(({ field: ref, before: was, after: is, change }) => [
        ref.entry?.position,
        ref.entry?.part,
        ref.language,
        was,
        is,
        change,
      ]);
  }

  it('pairs entries by their unique part, so a move is one row and a removal another', () => {
    expect(rows('species', { species: [HUMAN, GIANT] }, { species: [GIANT] })).toEqual([
      [1, 'species', null, 'Kyojin', 'Kyojin', 'UNCHANGED'],
      [1, 'position', null, '2', '1', 'MODIFIED'],
      [1, 'species', null, 'Ningen', null, 'REMOVED'],
    ]);
  });

  it('sees an entry added at the end as added, without touching the others', () => {
    expect(
      rows('aliases', { aliases: ['Sogeking'] }, { aliases: ['sogeking', 'Mr. Prince'] }),
    ).toEqual([
      [1, 'alias', null, 'Sogeking', 'sogeking', 'MODIFIED'],
      [2, 'alias', null, null, 'Mr. Prince', 'ADDED'],
    ]);
  });

  it('pairs entries by position without a unique part, a localized part once per language', () => {
    expect(
      rows(
        'epithets',
        { epithets: [{ text: { it: 'Gatta', en: 'Cat Burglar' } }] },
        {
          epithets: [
            { text: { it: 'Gatta ladra', en: 'Cat Burglar' } },
            { text: { it: 'Navigatrice' } },
          ],
        },
      ),
    ).toEqual([
      [1, 'text', 'it', 'Gatta', 'Gatta ladra', 'MODIFIED'],
      [1, 'text', 'en', 'Cat Burglar', 'Cat Burglar', 'UNCHANGED'],
      [2, 'text', 'it', null, 'Navigatrice', 'ADDED'],
    ]);
  });

  it('compares the other parts of an entry kept, each as its kind does', () => {
    expect(
      rows(
        'memberships',
        {
          memberships: [{ affiliation: NAVY, role: { en: 'Spy' }, rank: 'CAPTAIN', former: false }],
        },
        {
          memberships: [{ affiliation: NAVY, role: { en: 'Spy' }, rank: 'ADMIRAL', former: false }],
        },
      ),
    ).toEqual([
      [1, 'affiliation', null, 'Kaigun', 'Kaigun', 'UNCHANGED'],
      [1, 'role', 'en', 'Spy', 'Spy', 'UNCHANGED'],
      [1, 'rank', null, 'CAPTAIN', 'ADMIRAL', 'MODIFIED'],
      [1, 'former', null, 'false', 'false', 'UNCHANGED'],
    ]);
  });

  it('leaves out a list empty on both sides', () => {
    expect(rows('species', {}, { species: [] })).toEqual([]);
  });
});
