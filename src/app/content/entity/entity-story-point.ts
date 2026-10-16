/**
 * A point on the reader's axis - where the reader first meets a content, or learns of an
 * event (plan timeline, T7): today only a chapter; an episode is an open door. The API shows
 * it as `{ chapter: reference }` and is given `{ chapter: id }`. No Angular in here.
 */
import { isReference, type EntityReference } from './entity-reference';

/** The i18n key of a chapter as every screen names it: "Cap. 1 — Romance Dawn". */
export const STORY_POINT_CHAPTER_KEY = 'content.storyPoint.chapter';

/** The entity a story point picks among: the chapters. */
export const STORY_POINT_TARGET = 'CHAPTER';

/** The chapter of a story point read from the API, `null` where it has none. */
export function chapterOf(value: unknown): EntityReference | null {
  const chapter = (value as { chapter?: unknown } | null | undefined)?.chapter;
  return isReference(chapter) ? chapter : null;
}

/**
 * What follows "Cap." in the label of a chapter: its number and its title in `language` -
 * any title it has where `language` is `null` or has none - or the bare number.
 */
export function chapterText(chapter: EntityReference, language: string | null): string {
  const title =
    (language ? chapter.names[language] : null) || Object.values(chapter.names).find(Boolean);
  const number = typeof chapter.number === 'number' ? String(chapter.number) : chapter.id;
  return title ? `${number} — ${title}` : number;
}

/** A chapter as every screen names it, in `language`: "Cap. 1 — Romance Dawn". */
export function chapterLabel(
  translate: (key: string, params: Record<string, string>) => string,
  chapter: EntityReference,
  language: string | null,
): string {
  return translate(STORY_POINT_CHAPTER_KEY, { chapter: chapterText(chapter, language) });
}
