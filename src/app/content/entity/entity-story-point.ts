/**
 * A first appearance: where the reader first meets a content - a chapter of the manga, an
 * episode of the anime, or both, each optional. The API shows it as
 * `{ chapter: reference, episode: reference }` and is given `{ chapter: id, episode: id }`.
 * No Angular in here.
 */
import { isReference, type EntityReference } from './entity-reference';

/** The i18n key of a chapter as every screen names it: "Cap. 1 — Romance Dawn". */
export const STORY_POINT_CHAPTER_KEY = 'content.storyPoint.chapter';

/** The i18n key of an episode as every screen names it: "Ep. 4 — ...". */
export const STORY_POINT_EPISODE_KEY = 'content.storyPoint.episodeNumbered';

/** The entities a story point picks among, one per part. */
export const STORY_POINT_TARGETS = { chapter: 'CHAPTER', episode: 'EPISODE' } as const;

/** The parts of a story point: its chapter and its episode. */
export type StoryPointPart = keyof typeof STORY_POINT_TARGETS;

export const STORY_POINT_PARTS: readonly StoryPointPart[] = ['chapter', 'episode'];

/** A story point as the editor holds it: each part's reference whole, `null` where none. */
export interface StoryPointDraft {
  readonly chapter: EntityReference | null;
  readonly episode: EntityReference | null;
}

/** Translates a key with its parameters, as Transloco does. */
export type Translate = (key: string, params: Record<string, string>) => string;

/** One part of a story point read from the API (or held by the editor), `null` where none. */
function partOf(value: unknown, part: StoryPointPart): EntityReference | null {
  const reference = (value as Partial<Record<StoryPointPart, unknown>> | null | undefined)?.[part];
  return isReference(reference) ? reference : null;
}

/** The chapter of a story point, `null` where it has none. */
export function chapterOf(value: unknown): EntityReference | null {
  return partOf(value, 'chapter');
}

/** The episode of a story point, `null` where it has none. */
export function episodeOf(value: unknown): EntityReference | null {
  return partOf(value, 'episode');
}

/** A story point read from the API, or held by the editor, as the editor holds it. */
export function storyPointOf(value: unknown): StoryPointDraft {
  return { chapter: chapterOf(value), episode: episodeOf(value) };
}

/** Whether a story point names a chapter or an episode. */
export function isStoryPointFilled(value: unknown): boolean {
  return chapterOf(value) !== null || episodeOf(value) !== null;
}

/**
 * What follows "Cap." or "Ep." in the label of a chapter or an episode: its number and its
 * title in `language` - any title it has where `language` is `null` or has none - or the bare
 * number.
 */
export function storyItemText(item: EntityReference, language: string | null): string {
  const names = item.names ?? {};
  const title = (language ? names[language] : null) || Object.values(names).find(Boolean);
  const number = typeof item.number === 'number' ? String(item.number) : item.id;
  return title ? `${number} — ${title}` : number;
}

const PART_KEYS: Record<StoryPointPart, string> = {
  chapter: STORY_POINT_CHAPTER_KEY,
  episode: STORY_POINT_EPISODE_KEY,
};

/** A chapter or an episode as every screen names it, in `language`: "Cap. 1 — Romance Dawn". */
export function storyItemLabel(
  translate: Translate,
  part: StoryPointPart,
  item: EntityReference,
  language: string | null,
): string {
  return translate(PART_KEYS[part], { item: storyItemText(item, language) });
}

/** The texts a comparison shows of a story point: each part's number and title. */
export type StoryPointTexts = Partial<Record<StoryPointPart, string>>;

/**
 * A story point as a comparison carries it - a plain string, as every compared value is -
 * named in no language; `null` where it names nothing. Read back with `comparedParts`.
 */
export function comparedStoryPoint(value: unknown): string | null {
  const texts: StoryPointTexts = {};
  for (const part of STORY_POINT_PARTS) {
    const item = partOf(value, part);
    if (item) {
      texts[part] = storyItemText(item, null);
    }
  }
  return Object.keys(texts).length ? JSON.stringify(texts) : null;
}

/** A story point compared, as every screen names it: "Cap. 1 — Romance Dawn · Ep. 4 — ...". */
export function comparedStoryPointLabel(
  translate: Translate,
  compared: string | null,
): string | null {
  if (!compared) {
    return null;
  }
  const texts = JSON.parse(compared) as StoryPointTexts;
  return STORY_POINT_PARTS.filter((part) => texts[part])
    .map((part) => translate(PART_KEYS[part], { item: texts[part] as string }))
    .join(' · ');
}
