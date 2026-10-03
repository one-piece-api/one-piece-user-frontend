import {
  draftFieldKey,
  draftOf,
  isTranslationComplete,
  namesOf,
  readinessChecks,
  toDevilFruitType,
  type DevilFruitTypeDraft,
} from './devil-fruit-type.model';

describe('isTranslationComplete', () => {
  it('is complete with both a name and a description', () => {
    expect(isTranslationComplete({ name: 'Logia', description: 'Elemental.' })).toBe(true);
  });

  it.each([
    ['no description', { name: 'Logia', description: null }],
    ['no name', { name: null, description: 'Elemental.' }],
    ['a blank description', { name: 'Logia', description: '  ' }],
  ])('is incomplete with %s', (_case, translation) => {
    expect(isTranslationComplete(translation)).toBe(false);
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
        it: { name: 'Rogia', description: null },
        en: { name: null, description: 'Elemental.' },
      },
    });

    expect(names).toEqual({ it: 'Rogia' });
  });
});

describe('draftOf', () => {
  it('starts a new content from nothing, with a translation for every language', () => {
    expect(draftOf(null, ['it', 'en'])).toEqual({
      romaji: '',
      translations: { it: { name: '', description: '' }, en: { name: '', description: '' } },
    });
  });

  it('starts from what the version says, filling in what it lacks', () => {
    const draft = draftOf(
      {
        romaji: 'Shizen-kei',
        translations: {
          it: { name: 'Rogia', description: null },
          fr: { name: 'Logia', description: 'Élémentaire' },
        },
      },
      ['it', 'en'],
    );

    expect(draft).toEqual({
      romaji: 'Shizen-kei',
      translations: { it: { name: 'Rogia', description: '' }, en: { name: '', description: '' } },
    });
  });
});

describe('toDevilFruitType', () => {
  it('saves a draft without the space around its texts, and nothing written as null', () => {
    const draft: DevilFruitTypeDraft = {
      romaji: '  Shizen-kei ',
      translations: {
        it: { name: ' Rogia ', description: '   ' },
        en: { name: '', description: '' },
      },
    };

    expect(toDevilFruitType(draft)).toEqual({
      romaji: 'Shizen-kei',
      translations: {
        it: { name: 'Rogia', description: null },
        en: { name: null, description: null },
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
      it: { name: 'Rogia', description: 'Elementale.' },
      en: { name: ' ', description: '' },
    },
  };

  it('asks for the romaji, then a name and a description in every language', () => {
    expect(readinessChecks(half, ['it', 'en'])).toEqual([
      { field: 'romaji', language: null, done: true },
      { field: 'name', language: 'it', done: true },
      { field: 'description', language: 'it', done: true },
      { field: 'name', language: 'en', done: false },
      { field: 'description', language: 'en', done: false },
    ]);
  });

  it('asks for a language of the catalog the draft has nothing for', () => {
    const checks = readinessChecks(half, ['it', 'en', 'fr']);

    expect(checks.filter((check) => check.language === 'fr')).toEqual([
      { field: 'name', language: 'fr', done: false },
      { field: 'description', language: 'fr', done: false },
    ]);
  });
});

describe('draftFieldKey', () => {
  it.each([
    ['romaji', 'romaji'],
    ['translations[it].name', 'it.name'],
    ['translations[en].description', 'en.description'],
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
