import type { EntityReference } from './entity-reference';
import {
  chapterOf,
  comparedStoryPoint,
  comparedStoryPointLabel,
  episodeOf,
  isStoryPointFilled,
  storyItemLabel,
  storyItemText,
  storyPointOf,
} from './entity-story-point';

const ROMANCE_DAWN: EntityReference = {
  id: 'c1',
  number: 1,
  names: { it: "Romance Dawn - L'alba di una grande avventura", en: 'Romance Dawn' },
};

const EPISODE_4: EntityReference = { id: 'e4', number: 4, names: { en: 'Luffy’s Past' } };

const translate = (key: string, params: Record<string, string>) => `${key}:${params['item']}`;

describe('a story point', () => {
  it('reads its chapter and its episode from the API, none where there is no reference', () => {
    expect(chapterOf({ chapter: ROMANCE_DAWN })).toBe(ROMANCE_DAWN);
    expect(episodeOf({ chapter: ROMANCE_DAWN, episode: EPISODE_4 })).toBe(EPISODE_4);
    expect(chapterOf({})).toBeNull();
    expect(episodeOf(null)).toBeNull();
    expect(storyPointOf(undefined)).toEqual({ chapter: null, episode: null });
  });

  it('is filled by either part', () => {
    expect(isStoryPointFilled({ chapter: ROMANCE_DAWN })).toBe(true);
    expect(isStoryPointFilled({ episode: EPISODE_4 })).toBe(true);
    expect(isStoryPointFilled({ chapter: null, episode: null })).toBe(false);
  });

  it('names a chapter or an episode by its number and its title in the language asked', () => {
    expect(storyItemText(ROMANCE_DAWN, 'en')).toBe('1 — Romance Dawn');
    expect(storyItemText({ ...ROMANCE_DAWN, names: { it: 'Titolo' } }, 'en')).toBe('1 — Titolo');
    expect(storyItemText({ ...ROMANCE_DAWN, names: {} }, 'en')).toBe('1');
  });

  it('puts the chapter or the episode in the label every screen shows', () => {
    expect(storyItemLabel(translate, 'chapter', ROMANCE_DAWN, 'en')).toBe(
      'content.storyPoint.chapter:1 — Romance Dawn',
    );
    expect(storyItemLabel(translate, 'episode', EPISODE_4, 'en')).toBe(
      'content.storyPoint.episodeNumbered:4 — Luffy’s Past',
    );
  });

  it('is compared with both its parts named, nothing where it names none', () => {
    const compared = comparedStoryPoint({ chapter: ROMANCE_DAWN, episode: EPISODE_4 });

    expect(comparedStoryPointLabel(translate, compared)).toBe(
      "content.storyPoint.chapter:1 — Romance Dawn - L'alba di una grande avventura · content.storyPoint.episodeNumbered:4 — Luffy’s Past",
    );
    expect(comparedStoryPoint({ chapter: null, episode: null })).toBeNull();
    expect(comparedStoryPointLabel(translate, null)).toBeNull();
  });
});
