import { FIELD_KINDS } from './field-kinds';

describe.each(['text', 'localizedText'] as const)('the %s field kind', (kind) => {
  const strategy = FIELD_KINDS[kind];

  it('gives the editor an empty text for a value never written', () => {
    expect(strategy.draftValue(undefined)).toBe('');
    expect(strategy.draftValue(null)).toBe('');
    expect(strategy.draftValue('Logia')).toBe('Logia');
  });

  it('saves a text without the space around it, and a blank one as null', () => {
    expect(strategy.savedValue('  Logia\n')).toBe('Logia');
    expect(strategy.savedValue('   ')).toBeNull();
  });

  it('counts as filled only with something besides spaces', () => {
    expect(strategy.isFilled('Logia')).toBe(true);
    expect(strategy.isFilled(' ')).toBe(false);
    expect(strategy.isFilled(null)).toBe(false);
  });

  it('compares two texts, leaving out one absent on both sides', () => {
    expect(strategy.diff('f', 'Rogia', 'Logia')?.change).toBe('MODIFIED');
    expect(strategy.diff('f', null, 'Logia')?.change).toBe('ADDED');
    expect(strategy.diff('f', ' ', null)).toBeNull();
  });
});

describe('where a field kind keeps its value', () => {
  it('keeps a text on the version, a localized text in each translation', () => {
    expect(FIELD_KINDS.text.localized).toBe(false);
    expect(FIELD_KINDS.localizedText.localized).toBe(true);
  });
});
