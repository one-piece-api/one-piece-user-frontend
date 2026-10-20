import type { EntityReference } from './entity-reference';
import { FIELD_KINDS, isAskedByReview } from './field-kinds';

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

describe('the image field kind', () => {
  const strategy = FIELD_KINDS.image;
  const saved = { id: 'a1b2', url: '/api/content/images/a1b2' };
  const other = { id: 'c3d4', url: '/api/content/images/c3d4' };
  const file = new File([new Uint8Array(4)], 'fruit.png', { type: 'image/png' });

  it('keeps the image on the version and leaves it out of review', () => {
    expect(strategy.localized).toBe(false);
    expect(strategy.forReview).toBe(false);
  });

  it('gives the editor the saved image to keep, or none', () => {
    expect(strategy.draftValue(saved)).toEqual({ saved });
    expect(strategy.draftValue(null)).toBeNull();
    expect(strategy.draftValue(undefined)).toBeNull();
  });

  it('puts nothing in the JSON: the file travels beside it', () => {
    expect(strategy.savedValue({ chosen: file, preview: 'blob:x' })).toBeUndefined();
    expect(strategy.savedValue({ saved })).toBeUndefined();
  });

  it('counts an image kept or chosen as present', () => {
    expect(strategy.isFilled({ saved })).toBe(true);
    expect(strategy.isFilled({ chosen: file, preview: 'blob:x' })).toBe(true);
    expect(strategy.isFilled(null)).toBe(false);
  });

  it('compares the ids and shows the URL of each side', () => {
    expect(strategy.diff('f', saved, { ...saved, url: '/elsewhere' })?.change).toBe('UNCHANGED');
    expect(strategy.diff('f', saved, other)).toEqual({
      field: 'f',
      before: saved.url,
      after: other.url,
      change: 'MODIFIED',
    });
    expect(strategy.diff('f', null, other)?.change).toBe('ADDED');
    expect(strategy.diff('f', saved, null)).toMatchObject({ change: 'REMOVED', after: null });
    expect(strategy.diff('f', null, undefined)).toBeNull();
  });
});

describe('which field kinds review asks for', () => {
  it('asks for texts and relations, not for an image', () => {
    expect(FIELD_KINDS.text.forReview).toBe(true);
    expect(FIELD_KINDS.localizedText.forReview).toBe(true);
    expect(FIELD_KINDS.relation.forReview).toBe(true);
    expect(FIELD_KINDS.image.forReview).toBe(false);
  });
});

describe('the number field kind', () => {
  const strategy = FIELD_KINDS.number;

  it('is shared by every language and asked for by review', () => {
    expect(strategy.localized).toBe(false);
    expect(strategy.forReview).toBe(true);
  });

  it('gives the editor the digits of a saved number, else an empty text', () => {
    expect(strategy.draftValue(12)).toBe('12');
    expect(strategy.draftValue(0)).toBe('0');
    expect(strategy.draftValue(undefined)).toBe('');
    expect(strategy.draftValue(null)).toBe('');
  });

  it('saves digits as a number and anything else as nothing', () => {
    expect(strategy.savedValue(' 12 ')).toBe(12);
    expect(strategy.savedValue('0')).toBe(0);
    for (const written of ['', '-1', '1.5', 'abc', undefined]) {
      expect(strategy.savedValue(written)).toBeNull();
    }
  });

  it('counts 0 as filled, but not a negative, a decimal or text', () => {
    expect(strategy.isFilled(0)).toBe(true);
    expect(strategy.isFilled(7)).toBe(true);
    expect(strategy.isFilled('0')).toBe(true);
    expect(strategy.isFilled('12')).toBe(true);
    for (const value of [-1, 1.5, '', '-1', '1.5', 'abc', null, undefined]) {
      expect(strategy.isFilled(value)).toBe(false);
    }
  });

  it('compares the written forms: a saved 12 is the draft "12"', () => {
    const field = { name: 'number' };
    expect(strategy.diff(field, 12, '12')).toMatchObject({ change: 'UNCHANGED' });
    expect(strategy.diff(field, undefined, undefined)).toBeNull();
    expect(strategy.diff(field, 12, 13)).toMatchObject({ before: '12', after: '13' });
  });
});

describe('the releaseList field kind', () => {
  const strategy = FIELD_KINDS.releaseList;
  const saved = [
    { country: 'US', date: '1999-10-20' },
    { country: 'JP', date: '1997-10-20' },
  ];

  it('is not translated, and not asked for by review', () => {
    expect(strategy.localized).toBe(false);
    expect(strategy.forReview).toBe(false);
  });

  it('gives each saved entry a key for the editor, and an empty list for a value never written', () => {
    const drafts = strategy.draftValue(saved) as { key: string; country: string }[];

    expect(drafts.map(({ country }) => country)).toEqual(['US', 'JP']);
    expect(new Set(drafts.map(({ key }) => key)).size).toBe(2);
    expect(strategy.draftValue(undefined)).toEqual([]);
  });

  it('saves the complete entries without their keys, by date then country, and [] for none', () => {
    const drafts = [
      ...(strategy.draftValue(saved) as object[]),
      { key: 'x', country: 'IT', date: '' },
      { key: 'y', country: 'FR', date: '1997-10-20' },
    ];

    expect(strategy.savedValue(drafts)).toEqual([
      { country: 'FR', date: '1997-10-20' },
      { country: 'JP', date: '1997-10-20' },
      { country: 'US', date: '1999-10-20' },
    ]);
    expect(strategy.savedValue(undefined)).toEqual([]);
  });

  it('is filled with at least one complete entry', () => {
    expect(strategy.isFilled(saved)).toBe(true);
    expect(strategy.isFilled([{ key: 'x', country: 'IT', date: '' }])).toBe(false);
    expect(strategy.isFilled(null)).toBe(false);
  });

  it('compares the entries as one text, an entry per line', () => {
    expect(strategy.diff('f', saved, saved.slice(1))).toMatchObject({
      change: 'MODIFIED',
      before: 'JP 1997-10-20\nUS 1999-10-20',
      after: 'JP 1997-10-20',
    });
    expect(strategy.diff('f', undefined, [])).toBeNull();
  });
});

describe('which fields review asks for', () => {
  it('asks for a kind review looks at, unless the field is optional', () => {
    expect(isAskedByReview({ kind: 'number', key: 'number' })).toBe(true);
    expect(isAskedByReview({ kind: 'number', key: 'pages', optional: true })).toBe(false);
    expect(isAskedByReview({ kind: 'relation', key: 'arc', target: 'ARC', optional: true })).toBe(
      false,
    );
    expect(isAskedByReview({ kind: 'releaseList', key: 'releases' })).toBe(false);
  });

  it('names a numbered reference in a comparison by its number', () => {
    const arc: EntityReference = { id: 'a1', number: 0, names: {} };

    expect(FIELD_KINDS.relation.diff('f', null, arc)).toMatchObject({ after: '0' });
  });
});

describe('the storyPoint field kind', () => {
  const strategy = FIELD_KINDS.storyPoint;
  const chapter: EntityReference = { id: 'c1', number: 1, names: { en: 'Romance Dawn' } };
  const other: EntityReference = { id: 'c2', number: 2, names: { en: 'They Call Him' } };

  const episode: EntityReference = { id: 'e4', number: 4, names: { en: 'Luffy’s Past' } };

  it('gives the editor the chapter and the episode of the API value, none for none', () => {
    expect(strategy.draftValue({ chapter, episode })).toEqual({ chapter, episode });
    expect(strategy.draftValue({ chapter })).toEqual({ chapter, episode: null });
    expect(strategy.draftValue(null)).toEqual({ chapter: null, episode: null });
  });

  it('saves each part as its id, a part not chosen as null, and nothing chosen as null', () => {
    expect(strategy.savedValue({ chapter, episode: null })).toEqual({
      chapter: 'c1',
      episode: null,
    });
    expect(strategy.savedValue({ chapter: null, episode })).toEqual({
      chapter: null,
      episode: 'e4',
    });
    expect(strategy.savedValue({ chapter: null, episode: null })).toBeNull();
    expect(strategy.savedValue(null)).toBeNull();
  });

  it('counts as filled with a chapter or an episode', () => {
    expect(strategy.isFilled({ chapter, episode: null })).toBe(true);
    expect(strategy.isFilled({ episode })).toBe(true);
    expect(strategy.isFilled({ chapter: null, episode: null })).toBe(false);
    expect(strategy.isFilled(null)).toBe(false);
  });

  it('is kept on the version and asked for by review unless marked optional', () => {
    expect(strategy.localized).toBe(false);
    expect(isAskedByReview({ kind: 'storyPoint', key: 'firstAppearance' })).toBe(true);
    expect(isAskedByReview({ kind: 'storyPoint', key: 'lastSeen', optional: true })).toBe(false);
  });

  it('compares both parts by id, carrying their numbers and titles', () => {
    const diff = strategy.diff('f', { chapter }, { chapter: other, episode });

    expect(diff?.change).toBe('MODIFIED');
    expect(diff?.before).toBe(JSON.stringify({ chapter: '1 — Romance Dawn' }));
    expect(diff?.after).toBe(
      JSON.stringify({ chapter: '2 — They Call Him', episode: '4 — Luffy’s Past' }),
    );
    expect(strategy.diff('f', null, { episode })?.change).toBe('ADDED');
    expect(strategy.diff('f', { chapter }, { chapter: { ...chapter, names: {} } })?.change).toBe(
      'UNCHANGED',
    );
    expect(strategy.diff('f', null, {})).toBeNull();
  });
});
