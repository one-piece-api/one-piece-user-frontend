import { isReference, referenceLabel } from './entity-reference';

describe('a reference to another content', () => {
  const type = { id: 't1', romaji: 'Rogia', names: { it: 'Logia', en: 'Logia (en)' } };

  it('is told from an absent value or a bare id', () => {
    expect(isReference(type)).toBe(true);
    expect(isReference(null)).toBe(false);
    expect(isReference(undefined)).toBe(false);
    expect(isReference('t1')).toBe(false);
    expect(isReference({ romaji: 'Rogia' })).toBe(false);
  });

  it('is called by its name in the language, else its romaji, else its id', () => {
    expect(referenceLabel(type, 'en')).toBe('Logia (en)');
    expect(referenceLabel(type, 'fr')).toBe('Rogia');
    expect(referenceLabel({ id: 't2', romaji: null, names: {} }, 'it')).toBe('t2');
  });
});
