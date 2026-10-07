import type { EntityReference } from './entity-reference';
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

  it('keeps a relation on the version, whatever language it is read in', () => {
    expect(FIELD_KINDS.relation.localized).toBe(false);
  });
});

describe('the relation field kind', () => {
  const strategy = FIELD_KINDS.relation;
  const logia: EntityReference = { id: 't1', romaji: 'Rogia', names: { it: 'Logia' } };
  const zoan: EntityReference = { id: 't2', romaji: 'Zoan', names: { it: 'Zoan' } };

  it('holds the whole reference in the editor, and nothing for a value never written', () => {
    expect(strategy.draftValue(logia)).toBe(logia);
    expect(strategy.draftValue(undefined)).toBeNull();
    expect(strategy.draftValue(null)).toBeNull();
    expect(strategy.draftValue('t1')).toBeNull();
  });

  it('saves only the id of the reference, and null for none', () => {
    expect(strategy.savedValue(logia)).toBe('t1');
    expect(strategy.savedValue(null)).toBeNull();
  });

  it('counts as filled with a reference to something', () => {
    expect(strategy.isFilled(logia)).toBe(true);
    expect(strategy.isFilled(null)).toBe(false);
    expect(strategy.isFilled({ id: '' })).toBe(false);
  });

  it('compares the ids, naming the sides by romaji', () => {
    expect(strategy.diff('f', logia, zoan)).toMatchObject({
      change: 'MODIFIED',
      before: 'Rogia',
      after: 'Zoan',
    });
    expect(strategy.diff('f', null, logia)).toMatchObject({ change: 'ADDED', after: 'Rogia' });
    expect(strategy.diff('f', logia, null)).toMatchObject({ change: 'REMOVED', before: 'Rogia' });
  });

  it('does not see a rename as a change, and leaves out a relation absent on both sides', () => {
    const renamed = { ...logia, romaji: 'Logia', names: { it: 'Rogia' } };

    expect(strategy.diff('f', logia, renamed)).toMatchObject({ change: 'UNCHANGED' });
    expect(strategy.diff('f', null, null)).toBeNull();
  });

  it('falls back on the id to name a reference with no romaji', () => {
    expect(strategy.diff('f', null, { id: 't9', romaji: null, names: {} })?.after).toBe('t9');
  });
});
