import {
  diffBodies,
  draftFieldKey,
  draftOf,
  isLanguageComplete,
  isTranslationComplete,
  namesOf,
  readinessChecks,
  toBody,
  type EntityDraft,
  type Translation,
  type TranslationDraft,
} from '../entity/entity-body';
import { DEVIL_FRUIT_TYPE } from './devil-fruit-type.model';

/** A translation saying only what a test is about: the name, the one text written per language. */
function translation(fields: Partial<Translation>): Translation {
  return { name: null, ...fields };
}

/** The same, as the editor holds it: an empty string where nothing was typed. */
function typed(fields: Partial<TranslationDraft>): TranslationDraft {
  return { name: '', ...fields };
}

const COMPLETE = translation({ name: 'Logia' });

const CHAPTER_1 = { id: 'c1', number: 1, names: {} };
const CHAPTER_44 = { id: 'c44', number: 44, names: {} };
const EPISODE_4 = { id: 'e4', number: 4, names: {} };

/** A paragraph as the API sends it: its text per language and its window. */
function paragraph(text: Record<string, string>, discovered: unknown = { chapter: CHAPTER_1 }) {
  return { text, discovered, ended: null };
}

describe('isTranslationComplete', () => {
  it('is complete with a name: the paragraphs are lists of their own', () => {
    expect(isTranslationComplete(DEVIL_FRUIT_TYPE, COMPLETE)).toBe(true);
  });

  it.each([
    ['no name', { name: null }],
    ['a blank name', { name: '  ' }],
  ])('is incomplete with %s', (_case, incomplete) => {
    expect(isTranslationComplete(DEVIL_FRUIT_TYPE, incomplete)).toBe(false);
  });

  it('is incomplete for a language the version does not have at all', () => {
    expect(isTranslationComplete(DEVIL_FRUIT_TYPE, undefined)).toBe(false);
  });
});

describe('namesOf', () => {
  it('keeps the languages that have a name', () => {
    const names = namesOf(DEVIL_FRUIT_TYPE, {
      romaji: 'Shizen-kei',
      translations: { it: translation({ name: 'Rogia' }), en: translation({}) },
    });

    expect(names).toEqual({ it: 'Rogia' });
  });
});

describe('draftOf', () => {
  it('starts a new content from nothing, with a translation for every language and no paragraphs', () => {
    expect(draftOf(DEVIL_FRUIT_TYPE, null, ['it', 'en'])).toEqual({
      romaji: '',
      firstAppearance: { chapter: null, episode: null },
      description: [],
      advantages: [],
      disadvantages: [],
      subcategories: [],
      translations: { it: typed({}), en: typed({}) },
    });
  });

  it('starts from what the version says, filling in what it lacks', () => {
    const draft = draftOf(
      DEVIL_FRUIT_TYPE,
      {
        romaji: 'Shizen-kei',
        translations: {
          it: translation({ name: 'Rogia' }),
          fr: translation({ name: 'Logia' }),
        },
      },
      ['it', 'en'],
    );

    expect(draft['translations']).toEqual({ it: typed({ name: 'Rogia' }), en: typed({}) });
  });
});

describe('toBody', () => {
  it('saves a draft without the space around its texts, and nothing written as null', () => {
    const draft: EntityDraft = {
      romaji: '  Shizen-kei ',
      translations: { it: typed({ name: ' Rogia ' }), en: typed({}) },
    };

    expect(toBody(DEVIL_FRUIT_TYPE, draft)).toEqual({
      romaji: 'Shizen-kei',
      firstAppearance: null,
      description: [],
      advantages: [],
      disadvantages: [],
      subcategories: [],
      translations: { it: translation({ name: 'Rogia' }), en: translation({}) },
    });
  });

  it('saves each section as a list of paragraphs, each with its text per language and its window', () => {
    const draft = draftOf(
      DEVIL_FRUIT_TYPE,
      {
        romaji: 'Shizen-kei',
        translations: { it: translation({ name: 'Rogia' }) },
        description: [
          {
            text: { it: 'Creduti un mito.', en: 'Believed a myth.' },
            discovered: { chapter: CHAPTER_1 },
            ended: { chapter: CHAPTER_44 },
          },
          paragraph({ it: ' Elementali. ', en: 'Elemental.' }, { chapter: CHAPTER_44 }),
        ],
      },
      ['it', 'en'],
    );

    expect(toBody(DEVIL_FRUIT_TYPE, draft)['description']).toEqual([
      {
        text: { it: 'Creduti un mito.', en: 'Believed a myth.' },
        discovered: { chapter: 'c1', episode: null },
        ended: { chapter: 'c44', episode: null },
      },
      {
        text: { it: 'Elementali.', en: 'Elemental.' },
        discovered: { chapter: 'c44', episode: null },
        ended: null,
      },
    ]);
  });

  it('saves an empty romaji as null', () => {
    expect(toBody(DEVIL_FRUIT_TYPE, { romaji: ' ', translations: {} })['romaji']).toBeNull();
  });
});

describe('readinessChecks', () => {
  const half: EntityDraft = {
    romaji: 'Shizen-kei',
    translations: { it: typed({ name: 'Rogia' }), en: typed({ name: ' ' }) },
  };

  /** The checks of a draft of the type read from `body`, in Italian and English. */
  function checksOf(body: Record<string, unknown>) {
    return readinessChecks(
      DEVIL_FRUIT_TYPE,
      draftOf(DEVIL_FRUIT_TYPE, { romaji: 'Shizen-kei', translations: {}, ...body }, ['it', 'en']),
      ['it', 'en'],
    );
  }

  /** The section checks only: "description:false". */
  function sections(checks: ReturnType<typeof readinessChecks>): string[] {
    return checks
      .filter(({ entry }) => entry?.part === 'atFirstAppearance')
      .map(({ field, done }) => `${field}:${done}`);
  }

  it('asks for the romaji, the first appearance, a paragraph per section, then the name in every language', () => {
    expect(readinessChecks(DEVIL_FRUIT_TYPE, half, ['it', 'en'])).toEqual([
      { field: 'romaji', language: null, done: true },
      { field: 'firstAppearance', language: null, done: false },
      ...['description', 'advantages', 'disadvantages'].map((field) => ({
        field,
        language: null,
        entry: { id: field, position: 1, part: 'atFirstAppearance', name: null },
        done: false,
      })),
      { field: 'name', language: 'it', done: true },
      { field: 'name', language: 'en', done: false },
    ]);
  });

  it('closes a section with a paragraph discovered at the first appearance, not with one discovered later', () => {
    const checks = checksOf({
      firstAppearance: { chapter: CHAPTER_1 },
      description: [paragraph({ it: 'a', en: 'a' }, { chapter: CHAPTER_44 })],
      advantages: [
        paragraph({ it: 'b', en: 'b' }, { chapter: CHAPTER_44 }),
        paragraph({ it: 'c', en: 'c' }, { chapter: CHAPTER_1 }),
      ],
    });

    expect(sections(checks)).toEqual([
      'description:false',
      'advantages:true',
      'disadvantages:false',
    ]);
  });

  it('asks the paragraph for every axis the first appearance has', () => {
    const both = { chapter: CHAPTER_1, episode: EPISODE_4 };

    const chapterOnly = checksOf({
      firstAppearance: both,
      description: [paragraph({ it: 'a', en: 'a' }, { chapter: CHAPTER_1 })],
    });
    const same = checksOf({
      firstAppearance: both,
      description: [paragraph({ it: 'a', en: 'a' }, both)],
    });

    expect(sections(chapterOnly)[0]).toBe('description:false');
    expect(sections(same)[0]).toBe('description:true');
  });

  it('asks every paragraph for its text in every language and for its discovery', () => {
    const checks = checksOf({
      firstAppearance: { chapter: CHAPTER_1 },
      description: [paragraph({ it: 'Elementali.' }, null)],
    });

    expect(checks.filter(({ field, done }) => field === 'description' && !done)).toEqual([
      {
        field: 'description',
        language: null,
        entry: { id: expect.any(String), position: 1, part: 'discovered', name: null },
        done: false,
      },
      {
        field: 'description',
        language: null,
        entry: { id: 'description', position: 1, part: 'atFirstAppearance', name: null },
        done: false,
      },
      {
        field: 'description',
        language: 'en',
        entry: { id: expect.any(String), position: 1, part: 'text', name: null },
        done: false,
      },
    ]);
  });
});

describe('draftFieldKey', () => {
  it.each([
    ['romaji', 'romaji'],
    ['translations[it].name', 'it.name'],
    ['description', 'description'],
    ['description[0]', 'description.0'],
    ['description[1].text[en]', 'description.1.text.en'],
    ['advantages[0].discovered.chapter', 'advantages.0.discovered.chapter'],
    ['disadvantages[2].ended', 'disadvantages.2.ended'],
  ])('reads %s as %s', (field, key) => {
    expect(draftFieldKey(DEVIL_FRUIT_TYPE, field)).toBe(key);
  });

  it.each([
    'translations[it].other',
    'translations[en].description',
    'something',
    'translations.it.name',
  ])('does not know %s', (field) => {
    expect(draftFieldKey(DEVIL_FRUIT_TYPE, field)).toBeNull();
  });
});

describe('diffBodies', () => {
  const v1 = {
    romaji: 'Rogia',
    translations: { it: translation({ name: 'Rogia' }), en: translation({ name: 'Logia' }) },
    description: [paragraph({ it: 'Frutti elementali.' })],
  };

  /** "romaji", "name.it", "description.text.it": the fields of a comparison, with their change. */
  function changes(diffs: ReturnType<typeof diffBodies>): string[] {
    return diffs.map(
      ({ field, change }) =>
        [field.field, field.entry?.part, field.language].filter(Boolean).join('.') + ':' + change,
    );
  }

  /** The same, without the fields left as they were. */
  function changed(diffs: ReturnType<typeof diffBodies>): string[] {
    return changes(diffs).filter((change) => !change.endsWith(':UNCHANGED'));
  }

  it('lists the names, then the paragraphs of each section, in the catalog order', () => {
    const v2 = {
      romaji: 'Rogia',
      translations: { it: translation({ name: 'Rogia' }) },
      description: [paragraph({ it: 'Frutti elementali, i più rari.', en: 'Elemental fruits.' })],
      advantages: [paragraph({ it: 'Intangibili.' })],
    };

    expect(changed(diffBodies(DEVIL_FRUIT_TYPE, v1, v2, ['it', 'en']))).toEqual([
      'name.en:REMOVED',
      'description.text.it:MODIFIED',
      'description.text.en:ADDED',
      'advantages.text.it:ADDED',
      'advantages.discovered:ADDED',
    ]);
  });

  it('compares the window of a paragraph: an end added', () => {
    const v2 = {
      ...v1,
      description: [{ ...paragraph({ it: 'Frutti elementali.' }), ended: { chapter: CHAPTER_44 } }],
    };

    expect(changed(diffBodies(DEVIL_FRUIT_TYPE, v1, v2, ['it', 'en']))).toEqual([
      'description.ended:ADDED',
    ]);
  });

  it('compares the first version with an empty content: everything it says is added', () => {
    const diffs = diffBodies(DEVIL_FRUIT_TYPE, null, v1, ['it', 'en']);

    expect(changes(diffs).every((change) => change.endsWith(':ADDED'))).toBe(true);
    expect(diffs[0]).toEqual({
      field: { field: 'romaji', language: null },
      before: null,
      after: 'Rogia',
      change: 'ADDED',
    });
  });

  it('puts a language outside the catalog last', () => {
    const withGerman = {
      ...v1,
      translations: { ...v1.translations, de: translation({ name: 'Logia' }) },
    };

    expect(
      diffBodies(DEVIL_FRUIT_TYPE, v1, withGerman, ['en', 'it'])
        .filter(({ field }) => field.field === 'name')
        .map(({ field }) => field.language),
    ).toEqual(['en', 'it', 'de']);
  });

  it('finds no change between two identical versions', () => {
    expect(
      diffBodies(DEVIL_FRUIT_TYPE, v1, structuredClone(v1), ['it', 'en']).every(
        ({ change }) => change === 'UNCHANGED',
      ),
    ).toBe(true);
  });
});

describe('the subcategories of a type', () => {
  const ANCIENT = {
    id: 's1',
    translations: {
      it: { name: 'Antico', description: 'Estinti.' },
      en: { name: 'Ancient', description: 'Extinct.' },
    },
  };
  const MYTHICAL = {
    id: 's2',
    translations: {
      it: { name: 'Mitologico', description: 'Leggendari.' },
      en: { name: 'Mythical', description: null },
    },
  };
  const ZOAN = {
    romaji: 'Dobutsu-kei',
    translations: { it: COMPLETE, en: COMPLETE },
    subcategories: [ANCIENT, MYTHICAL],
  };

  it('are saved as they were read, ids and order kept', () => {
    const draft = draftOf(DEVIL_FRUIT_TYPE, ZOAN, ['it', 'en']);

    expect(toBody(DEVIL_FRUIT_TYPE, draft)['subcategories']).toEqual([
      { ...ANCIENT, firstAppearance: null },
      { ...MYTHICAL, firstAppearance: null },
    ]);
  });

  it('ask review for a name and a description in every language', () => {
    const draft = draftOf(DEVIL_FRUIT_TYPE, ZOAN, ['it', 'en']);
    // The sections of paragraphs ask for theirs: not what this test is about.
    const missing = readinessChecks(DEVIL_FRUIT_TYPE, draft, ['it', 'en']).filter(
      ({ done, entry }) => !done && entry?.part !== 'atFirstAppearance',
    );

    expect(missing).toEqual([
      { field: 'firstAppearance', language: null, done: false },
      {
        field: 'subcategories',
        language: 'en',
        entry: { id: 's2', position: 2, part: 'description', name: 'Mythical' },
        done: false,
      },
    ]);
    expect(isLanguageComplete(DEVIL_FRUIT_TYPE, ZOAN, 'it')).toBe(true);
    expect(isLanguageComplete(DEVIL_FRUIT_TYPE, ZOAN, 'en')).toBe(false);
  });

  it('save the chapter of their first appearance by id, none as null', () => {
    const romanceDawn = { id: 'c1', number: 1, names: { en: 'Romance Dawn' } };
    const draft = draftOf(
      DEVIL_FRUIT_TYPE,
      {
        ...ZOAN,
        subcategories: [{ ...ANCIENT, firstAppearance: { chapter: romanceDawn } }, MYTHICAL],
      },
      ['it', 'en'],
    );

    expect(
      (toBody(DEVIL_FRUIT_TYPE, draft)['subcategories'] as { firstAppearance: unknown }[]).map(
        ({ firstAppearance }) => firstAppearance,
      ),
    ).toEqual([{ chapter: 'c1', episode: null }, null]);
  });

  it('compare the first appearance of a subcategory, once for every language', () => {
    const chapter = (id: string, number: number) => ({ chapter: { id, number, names: {} } });
    const v1 = { ...ZOAN, subcategories: [{ ...ANCIENT, firstAppearance: chapter('c1', 1) }] };
    const v2 = { ...ZOAN, subcategories: [{ ...ANCIENT, firstAppearance: chapter('c2', 2) }] };

    const changed = diffBodies(DEVIL_FRUIT_TYPE, v1, v2, ['it', 'en']).filter(
      ({ change }) => change !== 'UNCHANGED',
    );

    expect(changed.map(({ field }) => [field.entry?.part, field.language])).toEqual([
      ['firstAppearance', null],
    ]);
  });

  it.each([
    ['subcategories[0].firstAppearance.chapter', 'subcategories.0.firstAppearance'],
    ['subcategories[1].firstAppearance', 'subcategories.1.firstAppearance'],
    ['subcategories[1].translations[en].name', 'en.subcategories.1.name'],
    ['subcategories[0].translations[it].description', 'it.subcategories.0.description'],
    ['subcategories[2].id', 'subcategories.2'],
    ['subcategories', 'subcategories'],
  ])('read %s as %s', (field, key) => {
    expect(draftFieldKey(DEVIL_FRUIT_TYPE, field)).toBe(key);
  });

  it('are compared by id: renamed, added and removed', () => {
    const renamed = {
      ...MYTHICAL,
      translations: { ...MYTHICAL.translations, en: { name: 'Mythic', description: null } },
    };
    const artificial = {
      id: 's3',
      translations: { it: { name: 'Artificiale', description: 'SMILE.' } },
    };
    const v2 = { ...ZOAN, subcategories: [renamed, artificial] };

    const changed = diffBodies(DEVIL_FRUIT_TYPE, ZOAN, v2, ['it', 'en'])
      .filter(({ change }) => change !== 'UNCHANGED')
      .map(({ field, change, before, after }) => [
        `${field.entry?.id}.${field.entry?.part}.${field.language}`,
        change,
        before,
        after,
      ]);

    expect(changed).toEqual([
      ['s2.name.en', 'MODIFIED', 'Mythical', 'Mythic'],
      ['s3.name.it', 'ADDED', null, 'Artificiale'],
      ['s3.description.it', 'ADDED', null, 'SMILE.'],
      ['s1.name.it', 'REMOVED', 'Antico', null],
      ['s1.description.it', 'REMOVED', 'Estinti.', null],
      ['s1.name.en', 'REMOVED', 'Ancient', null],
      ['s1.description.en', 'REMOVED', 'Extinct.', null],
    ]);
  });
});
