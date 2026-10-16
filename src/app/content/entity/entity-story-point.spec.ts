import type { EntityReference } from './entity-reference';
import { chapterLabel, chapterOf, chapterText } from './entity-story-point';

const ROMANCE_DAWN: EntityReference = {
  id: 'c1',
  number: 1,
  names: { it: "Romance Dawn - L'alba di una grande avventura", en: 'Romance Dawn' },
};

describe('a story point', () => {
  it('reads its chapter from the API, none where there is no reference', () => {
    expect(chapterOf({ chapter: ROMANCE_DAWN })).toBe(ROMANCE_DAWN);
    expect(chapterOf({})).toBeNull();
    expect(chapterOf(null)).toBeNull();
    expect(chapterOf(undefined)).toBeNull();
  });

  it('names a chapter by its number and its title in the language asked', () => {
    expect(chapterText(ROMANCE_DAWN, 'en')).toBe('1 — Romance Dawn');
    expect(chapterText({ ...ROMANCE_DAWN, names: { it: 'Titolo' } }, 'en')).toBe('1 — Titolo');
    expect(chapterText({ ...ROMANCE_DAWN, names: {} }, 'en')).toBe('1');
  });

  it('puts the chapter in the label every screen shows', () => {
    const translate = (key: string, params: Record<string, string>) =>
      `${key}:${params['chapter']}`;
    expect(chapterLabel(translate, ROMANCE_DAWN, 'en')).toBe(
      'content.storyPoint.chapter:1 — Romance Dawn',
    );
  });
});
