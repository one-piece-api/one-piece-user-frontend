import {
  diffDevilFruitTypes,
  draftFieldKey,
  draftOf,
  isTranslationComplete,
  namesOf,
  readinessChecks,
  toDevilFruitType,
  type DevilFruitTypeDraft,
  type DevilFruitTypeTranslation,
  type TranslationDraft,
} from './devil-fruit-type.model';

/** A translation saying only what a test is about: every other field not written. */
function translation(fields: Partial<DevilFruitTypeTranslation>): DevilFruitTypeTranslation {
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
    expect(isTranslationComplete(COMPLETE)).toBe(true);
  });

  it.each([
    ['no description', { ...COMPLETE, description: null }],
    ['no name', { ...COMPLETE, name: null }],
    ['a blank description', { ...COMPLETE, description: '  ' }],
    ['no advantages', { ...COMPLETE, advantages: null }],
    ['blank disadvantages', { ...COMPLETE, disadvantages: ' ' }],
  ])('is incomplete with %s', (_case, incomplete) => {
    expect(isTranslationComplete(incomplete)).toBe(false);
  });

  it('is incomplete for a language the version does not have at all', () => {
    expect(isTranslationComplete(undefined)).toBe(false);
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
    expect(draftOf(null, ['it', 'en'])).toEqual({
      romaji: '',
      translations: { it: typed({}), en: typed({}) },
    });
  });

  it('starts from what the version says, filling in what it lacks', () => {
    const draft = draftOf(
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
      translations: { it: typed({ name: 'Rogia', advantages: 'Intangibile.' }), en: typed({}) },
    });
  });
});

describe('toDevilFruitType', () => {
  it('saves a draft without the space around its texts, and nothing written as null', () => {
    const draft: DevilFruitTypeDraft = {
      romaji: '  Shizen-kei ',
      translations: {
        it: typed({ name: ' Rogia ', description: '   ', disadvantages: ' Acqua di mare\n' }),
        en: typed({}),
      },
    };

    expect(toDevilFruitType(draft)).toEqual({
      romaji: 'Shizen-kei',
      translations: {
        it: translation({ name: 'Rogia', disadvantages: 'Acqua di mare' }),
        en: translation({}),
      },
    });
  });

  it('saves an empty romaji as null', () => {
    expect(toDevilFruitType({ romaji: ' ', translations: {} }).romaji).toBeNull();
  });
});

describe('readinessChecks', () => {
  const half: DevilFruitTypeDraft = {
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
    expect(readinessChecks(half, ['it', 'en'])).toEqual([
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
    const checks = readinessChecks(half, ['it', 'en', 'fr']);

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
    expect(draftFieldKey(field)).toBe(key);
  });

  it.each(['translations[it].other', 'something', 'translations.it.name'])(
    'does not know %s',
    (field) => {
      expect(draftFieldKey(field)).toBeNull();
    },
  );
});

describe('diffDevilFruitTypes', () => {
  const v1 = {
    romaji: 'Rogia',
    translations: {
      it: translation({ name: 'Rogia', description: 'Frutti elementali.' }),
      en: translation({ name: 'Logia' }),
    },
  };

  /** "romaji", "name.it": the fields of a comparison, in order, with their change. */
  function changes(diffs: ReturnType<typeof diffDevilFruitTypes>): string[] {
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

    expect(changes(diffDevilFruitTypes(v1, v2, ['it', 'en']))).toEqual([
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

    expect(changes(diffDevilFruitTypes(v1, v2, ['it', 'en'])).slice(-3)).toEqual([
      'advantages.it:ADDED',
      'disadvantages.it:ADDED',
      'disadvantages.en:ADDED',
    ]);
  });

  it('compares the first version with an empty content: everything it says is added', () => {
    const diffs = diffDevilFruitTypes(null, v1, ['it', 'en']);

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

    expect(changes(diffDevilFruitTypes(v1, withFrench, ['it', 'en', 'fr']))).toEqual([
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
      diffDevilFruitTypes(v1, withGerman, ['en', 'it'])
        .filter(({ field }) => field.field === 'name')
        .map(({ field }) => field.language),
    ).toEqual(['en', 'it', 'de']);
  });

  it('finds no change between two identical versions', () => {
    expect(
      diffDevilFruitTypes(v1, structuredClone(v1), ['it', 'en']).every(
        ({ change }) => change === 'UNCHANGED',
      ),
    ).toBe(true);
  });
});
