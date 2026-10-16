/**
 * When an event happens or ends, on the world's axis (plan timeline, T3-T4): exactly one of a
 * chapter - in the story - or a world date - a year, or a span of years, before it. The API
 * shows it as `{ chapter: reference }` or `{ worldDate: { yearFrom, yearTo, approximate } }`
 * and is given `{ chapter: id }` or the same world date. No Angular in here.
 */
import { STORY_START_YEAR } from '../../config/timeline';
import type { EntityReference } from './entity-reference';
import { chapterOf, chapterText } from './entity-story-point';

/** The two halves of the switch: in the story, by chapter, or before it, by year. */
export type EventTimeMode = 'chapter' | 'year';

/** A year, or a span of years, of the One Piece calendar, as the API shows it. */
export interface WorldDate {
  readonly yearFrom: number;
  readonly yearTo: number | null;
  readonly approximate: boolean;
}

/**
 * What the editor holds: the mode picked, and what each mode was given - switching back and
 * forth keeps both. The years are the strings typed, as for a number field.
 */
export interface EventTimeDraft {
  readonly mode: EventTimeMode;
  readonly chapter: EntityReference | null;
  readonly yearFrom: string;
  readonly yearTo: string;
  readonly approximate: boolean;
}

/** What the editor says, under the field, before the backend is asked. */
export type EventTimeProblem =
  'yearsOutOfOrder' | 'afterStoryStart' | 'beforeStart' | 'yearAfterChapter';

/** A year as typed: only digits, as the calendar of the story has no year 0 or before. */
const YEAR = /^\d+$/;

export const EMPTY_EVENT_TIME: EventTimeDraft = {
  mode: 'chapter',
  chapter: null,
  yearFrom: '',
  yearTo: '',
  approximate: false,
};

/** The world date of a value read from the API, `null` where it has none. */
export function worldDateOf(value: unknown): WorldDate | null {
  const date = (value as { worldDate?: Partial<WorldDate> } | null | undefined)?.worldDate;
  return date && typeof date.yearFrom === 'number'
    ? {
        yearFrom: date.yearFrom,
        yearTo: typeof date.yearTo === 'number' ? date.yearTo : null,
        approximate: date.approximate === true,
      }
    : null;
}

/** What the editor starts from: the chapter or the world date saved, else an empty chapter. */
export function eventTimeDraftOf(saved: unknown): EventTimeDraft {
  const date = worldDateOf(saved);
  if (date) {
    return {
      ...EMPTY_EVENT_TIME,
      mode: 'year',
      yearFrom: String(date.yearFrom),
      yearTo: date.yearTo === null ? '' : String(date.yearTo),
      approximate: date.approximate,
    };
  }
  return { ...EMPTY_EVENT_TIME, chapter: chapterOf(saved) };
}

/** Whether a value is what the editor holds rather than what the API shows. */
export function isEventTimeDraft(value: unknown): value is EventTimeDraft {
  const mode = (value as Partial<EventTimeDraft> | null | undefined)?.mode;
  return mode === 'chapter' || mode === 'year';
}

/** A year typed, as a number; `null` for none or one that is no year. */
function yearOf(written: string): number | null {
  const trimmed = written.trim();
  return YEAR.test(trimmed) ? Number(trimmed) : null;
}

/** The world date the years typed make, `null` while the first year is not a year. */
export function worldDateOfDraft(draft: EventTimeDraft): WorldDate | null {
  const yearFrom = yearOf(draft.yearFrom);
  return yearFrom === null
    ? null
    : { yearFrom, yearTo: yearOf(draft.yearTo), approximate: draft.approximate };
}

/**
 * What the JSON is given: the chapter's id, or the world date - `null` while the mode picked
 * has nothing, so the other mode's leftovers are never sent.
 */
export function eventTimeSaved(draft: unknown): unknown {
  if (!isEventTimeDraft(draft)) {
    return null;
  }
  if (draft.mode === 'chapter') {
    return draft.chapter ? { chapter: draft.chapter.id } : null;
  }
  const date = worldDateOfDraft(draft);
  return date && { worldDate: date };
}

/** Whether a value - saved, or being written - says when. */
export function isEventTimeFilled(value: unknown): boolean {
  return isEventTimeDraft(value)
    ? eventTimeSaved(value) !== null
    : chapterOf(value) !== null || worldDateOf(value) !== null;
}

/** A world date as every screen writes it: "1498", "c. 1500", "c. 700–800". */
export function worldDateText(date: WorldDate): string {
  const span = date.yearTo !== null && date.yearTo !== date.yearFrom;
  return `${date.approximate ? 'c. ' : ''}${date.yearFrom}${span ? `–${date.yearTo}` : ''}`;
}

/**
 * How many years before the story begins a world date is: "22", "722–822" - `null` for one
 * that reaches the year the story starts, which is no "before".
 */
export function yearsBeforeStory(
  date: WorldDate,
  storyStartYear = STORY_START_YEAR,
): string | null {
  const fromStart = storyStartYear - date.yearFrom;
  if (fromStart <= 0) {
    return null;
  }
  const toStart = date.yearTo === null ? fromStart : storyStartYear - date.yearTo;
  return toStart !== fromStart && toStart > 0 ? `${toStart}–${fromStart}` : String(fromStart);
}

/** A value, saved or being written, as compared: "908 — Reverie" or "c. 700–800". */
export function eventTimeText(value: unknown): string | null {
  if (isEventTimeDraft(value)) {
    return eventTimeText(eventTimeSaved(value) && savedShape(value));
  }
  const chapter = chapterOf(value);
  if (chapter) {
    return chapterText(chapter, null);
  }
  const date = worldDateOf(value);
  return date && worldDateText(date);
}

/** A draft in the API's shape, with the chapter whole, so it is named like a saved one. */
function savedShape(draft: EventTimeDraft): unknown {
  return draft.mode === 'chapter'
    ? { chapter: draft.chapter }
    : { worldDate: worldDateOfDraft(draft) };
}

/** Where a value sits on the world's axis: any year before every chapter. */
type Instant =
  | { readonly kind: 'year'; readonly from: number; readonly to: number }
  | { readonly kind: 'chapter'; readonly number: number };

function instantOf(value: unknown): Instant | null {
  const saved = isEventTimeDraft(value) ? savedShape(value) : value;
  const date = worldDateOf(saved);
  if (date) {
    return { kind: 'year', from: date.yearFrom, to: date.yearTo ?? date.yearFrom };
  }
  const number = chapterOf(saved)?.number;
  return typeof number === 'number' ? { kind: 'chapter', number } : null;
}

/**
 * What is wrong with a time before saving, the checks the backend makes too - which stays the
 * authority: a span whose end comes before its start, a year after the story starts, and,
 * given the time it must not precede (`start`), an end certainly before it - a year ending
 * an event that happens in a chapter is never right. `null` when nothing is.
 */
export function eventTimeProblem(
  value: unknown,
  start?: unknown,
  storyStartYear = STORY_START_YEAR,
): EventTimeProblem | null {
  if (isEventTimeDraft(value) && value.mode === 'year') {
    const date = worldDateOfDraft(value);
    const last = date && (date.yearTo ?? date.yearFrom);
    if (date && last !== null && last < date.yearFrom) {
      return 'yearsOutOfOrder';
    }
    if (last !== null && last > storyStartYear) {
      return 'afterStoryStart';
    }
  }
  const end = instantOf(value);
  const begin = start === undefined ? null : instantOf(start);
  if (!end || !begin) {
    return null;
  }
  if (end.kind === 'year' && begin.kind === 'chapter') {
    return 'yearAfterChapter';
  }
  const before =
    end.kind === 'chapter' && begin.kind === 'chapter'
      ? end.number < begin.number
      : end.kind === 'year' && begin.kind === 'year' && end.to < begin.from;
  return before ? 'beforeStart' : null;
}

/**
 * What a refusal of the backend on a time says, by the path it names: a year after the story
 * starts (`occursAt.worldDate.yearTo`), years out of order (`occursAt.worldDate`), a chapter
 * that cannot be linked (`occursAt.chapter`), or - named whole, as invalid - an end before
 * the start (`endsAt`).
 */
export function eventTimeRefusal(
  path: string,
  field: string,
): EventTimeProblem | 'notLinkable' | null {
  const rest = path.slice(field.length);
  if (/^\.worldDate\.year(From|To)$/.test(rest)) {
    return 'afterStoryStart';
  }
  if (rest === '.worldDate') {
    return 'yearsOutOfOrder';
  }
  if (rest === '.chapter') {
    return 'notLinkable';
  }
  return rest === '' ? 'beforeStart' : null;
}
