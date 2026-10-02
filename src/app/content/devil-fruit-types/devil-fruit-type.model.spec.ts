import { isTranslationComplete, namesOf } from './devil-fruit-type.model';

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
