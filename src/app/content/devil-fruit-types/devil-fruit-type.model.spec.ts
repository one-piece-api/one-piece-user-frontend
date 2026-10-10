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

/** A translation saying only what a test is about: every other field not written. */
function translation(fields: Partial<Translation>): Translation {
  return { name: null, description: null, advantages: null, disadvantages: null, ...fields };
}

/** The same, as the editor holds it: an empty string where nothing was typed. */
function typed(fields: Partial<TranslationDraft>): TranslationDraft {
  return { name: '', description: '', advantages: '', disadvantages: '', ...fields };
}

const COMPLETE = translation({
  name: 'Logia',
  description: 'Elemental.',
  advantages: 'Intangible.',
  disadvantages: 'Sea water.',
});

describe('isTranslationComplete', () => {
  it('is complete with a name, a description, advantages and disadvantages', () => {
    expect(isTranslationComplete(DEVIL_FRUIT_TYPE, COMPLETE)).toBe(true);
  });

  it.each([
    ['no description', { ...COMPLETE, description: null }],
    ['no name', { ...COMPLETE, name: null }],
    ['a blank description', { ...COMPLETE, description: '  ' }],
    ['no advantages', { ...COMPLETE, advantages: null }],
    ['blank disadvantages', { ...COMPLETE, disadvantages: ' ' }],
  ])('is incomplete with %s', (_case, incomplete) => {
    expect(isTranslationComplete(DEVIL_FRUIT_TYPE, incomplete)).toBe(false);
  });

  it('is incomplete for a language the version does not have at all', () => {
    expect(isTranslationComplete(DEVIL_FRUIT_TYPE, undefined)).toBe(false);
  });
});

describe('namesOf', () => {
  it('keeps the languages that have a name', () => {
    const names = namesOf({
      romaji: 'Shizen-kei',
      translations: {
        it: translation({ name: 'Rogia' }),
        en: translation({ description: 'Elemental.' }),
      },
    });

    expect(names).toEqual({ it: 'Rogia' });
  });
});

describe('draftOf', () => {
  it('starts a new content from nothing, with a translation for every language', () => {
    expect(draftOf(DEVIL_FRUIT_TYPE, null, ['it', 'en'])).toEqual({
      romaji: '',
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
          it: translation({ name: 'Rogia', advantages: 'Intangibile.' }),
          fr: translation({ name: 'Logia', description: 'Élémentaire' }),
        },
      },
      ['it', 'en'],
    );

    expect(draft).toEqual({
      romaji: 'Shizen-kei',
      subcategories: [],
      translations: { it: typed({ name: 'Rogia', advantages: 'Intangibile.' }), en: typed({}) },
    });
  });
});

describe('toBody', () => {
  it('saves a draft without the space around its texts, and nothing written as null', () => {
    const draft: EntityDraft = {
      romaji: '  Shizen-kei ',
      translations: {
        it: typed({ name: ' Rogia ', description: '   ', disadvantages: ' Acqua di mare\n' }),
        en: typed({}),
      },
    };

    expect(toBody(DEVIL_FRUIT_TYPE, draft)).toEqual({
      romaji: 'Shizen-kei',
      subcategories: [],
      translations: {
        it: translation({ name: 'Rogia', disadvantages: 'Acqua di mare' }),
        en: translation({}),
      },
    });
  });

  it('saves an empty romaji as null', () => {
    expect(toBody(DEVIL_FRUIT_TYPE, { romaji: ' ', translations: {} }).romaji).toBeNull();
  });
});

describe('readinessChecks', () => {
  const half: EntityDraft = {
    romaji: 'Shizen-kei',
    translations: {
      it: typed({
        name: 'Rogia',
        description: 'Elementale.',
        advantages: 'Intangibile.',
        disadvantages: 'Acqua di mare.',
      }),
      en: typed({ name: ' ', advantages: 'Intangible.' }),
    },
  };

  it('asks for the romaji, then every translated field in every language', () => {
    expect(readinessChecks(DEVIL_FRUIT_TYPE, half, ['it', 'en'])).toEqual([
      { field: 'romaji', language: null, done: true },
      { field: 'name', language: 'it', done: true },
      { field: 'description', language: 'it', done: true },
      { field: 'advantages', language: 'it', done: true },
      { field: 'disadvantages', language: 'it', done: true },
      { field: 'name', language: 'en', done: false },
      { field: 'description', language: 'en', done: false },
      { field: 'advantages', language: 'en', done: true },
      { field: 'disadvantages', language: 'en', done: false },
    ]);
  });

  it('asks for a language of the catalog the draft has nothing for', () => {
    const checks = readinessChecks(DEVIL_FRUIT_TYPE, half, ['it', 'en', 'fr']);

    expect(checks.filter((check) => check.language === 'fr')).toEqual([
      { field: 'name', language: 'fr', done: false },
      { field: 'description', language: 'fr', done: false },
      { field: 'advantages', language: 'fr', done: false },
      { field: 'disadvantages', language: 'fr', done: false },
    ]);
  });
});

describe('draftFieldKey', () => {
  it.each([
    ['romaji', 'romaji'],
    ['translations[it].name', 'it.name'],
    ['translations[en].description', 'en.description'],
    ['translations[it].advantages', 'it.advantages'],
    ['translations[en].disadvantages', 'en.disadvantages'],
  ])('reads %s as %s', (field, key) => {
    expect(draftFieldKey(DEVIL_FRUIT_TYPE, field)).toBe(key);
  });

  it.each(['translations[it].other', 'something', 'translations.it.name'])(
    'does not know %s',
    (field) => {
      expect(draftFieldKey(DEVIL_FRUIT_TYPE, field)).toBeNull();
    },
  );
});

describe('diffBodies', () => {
  const v1 = {
    romaji: 'Rogia',
    translations: {
      it: translation({ name: 'Rogia', description: 'Frutti elementali.' }),
      en: translation({ name: 'Logia' }),
    },
  };

  /** "romaji", "name.it": the fields of a comparison, in order, with their change. */
  function changes(diffs: ReturnType<typeof diffBodies>): string[] {
    return diffs.map(
      ({ field, change }) => [field.field, field.language].filter(Boolean).join('.') + ':' + change,
    );
  }

  it('lists the romaji, then the names, then the descriptions, in the catalog order', () => {
    const v2 = {
      romaji: 'Rogia',
      translations: {
        it: translation({ name: 'Rogia', description: 'Frutti elementali, i più rari.' }),
        en: translation({ description: 'Elemental fruits.' }),
      },
    };

    expect(changes(diffBodies(DEVIL_FRUIT_TYPE, v1, v2, ['it', 'en']))).toEqual([
      'romaji:UNCHANGED',
      'name.it:UNCHANGED',
      'name.en:REMOVED',
      'description.it:MODIFIED',
      'description.en:ADDED',
    ]);
  });

  it('lists the advantages and then the disadvantages after the descriptions', () => {
    const v2 = {
      romaji: 'Rogia',
      translations: {
        it: translation({
          ...v1.translations.it,
          advantages: 'Intangibile.',
          disadvantages: 'Acqua di mare.',
        }),
        en: translation({ ...v1.translations.en, disadvantages: 'Sea water.' }),
      },
    };

    expect(changes(diffBodies(DEVIL_FRUIT_TYPE, v1, v2, ['it', 'en'])).slice(-3)).toEqual([
      'advantages.it:ADDED',
      'disadvantages.it:ADDED',
      'disadvantages.en:ADDED',
    ]);
  });

  it('compares the first version with an empty content: everything it says is added', () => {
    const diffs = diffBodies(DEVIL_FRUIT_TYPE, null, v1, ['it', 'en']);

    expect(changes(diffs)).toEqual([
      'romaji:ADDED',
      'name.it:ADDED',
      'name.en:ADDED',
      'description.it:ADDED',
    ]);
    expect(diffs[0]).toEqual({
      field: { field: 'romaji', language: null },
      before: null,
      after: 'Rogia',
      change: 'ADDED',
    });
  });

  it('shows a language present on one side only as added or removed', () => {
    const withFrench = {
      romaji: 'Rogia',
      translations: {
        it: v1.translations.it,
        fr: translation({ name: 'Logia', description: 'Élémentaire.' }),
      },
    };

    expect(changes(diffBodies(DEVIL_FRUIT_TYPE, v1, withFrench, ['it', 'en', 'fr']))).toEqual([
      'romaji:UNCHANGED',
      'name.it:UNCHANGED',
      'name.en:REMOVED',
      'name.fr:ADDED',
      'description.it:UNCHANGED',
      'description.fr:ADDED',
    ]);
  });

  it('puts a language outside the catalog last', () => {
    const withGerman = {
      romaji: 'Rogia',
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

    expect(toBody(DEVIL_FRUIT_TYPE, draft)['subcategories']).toEqual([ANCIENT, MYTHICAL]);
  });

  it('ask review for a name and a description in every language', () => {
    const draft = draftOf(DEVIL_FRUIT_TYPE, ZOAN, ['it', 'en']);
    const missing = readinessChecks(DEVIL_FRUIT_TYPE, draft, ['it', 'en']).filter(
      ({ done }) => !done,
    );

    expect(missing).toEqual([
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

  it.each([
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
