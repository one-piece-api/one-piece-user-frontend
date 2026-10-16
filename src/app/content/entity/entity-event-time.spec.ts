import {
  EMPTY_EVENT_TIME,
  eventTimeDraftOf,
  eventTimeProblem,
  eventTimeRefusal,
  eventTimeSaved,
  eventTimeText,
  isEventTimeFilled,
  worldDateText,
  yearsBeforeStory,
  type EventTimeDraft,
} from './entity-event-time';
import type { EntityReference } from './entity-reference';

const REVERIE: EntityReference = { id: 'c908', number: 908, names: { en: 'The Reverie' } };
const ONIGASHIMA: EntityReference = { id: 'c1000', number: 1000, names: {} };

function years(yearFrom: string, yearTo = '', approximate = false): EventTimeDraft {
  return { ...EMPTY_EVENT_TIME, mode: 'year', yearFrom, yearTo, approximate };
}

function inChapter(chapter: EntityReference): EventTimeDraft {
  return { ...EMPTY_EVENT_TIME, chapter };
}

describe('an event time', () => {
  it('starts the editor on a chapter, the one saved or none', () => {
    expect(eventTimeDraftOf(null)).toEqual(EMPTY_EVENT_TIME);
    expect(eventTimeDraftOf({ chapter: REVERIE })).toEqual(inChapter(REVERIE));
  });

  it('starts the editor on the years of a world date saved', () => {
    expect(
      eventTimeDraftOf({ worldDate: { yearFrom: 700, yearTo: 800, approximate: true } }),
    ).toEqual(years('700', '800', true));
    expect(eventTimeDraftOf({ worldDate: { yearFrom: 1498, approximate: false } })).toEqual(
      years('1498'),
    );
  });

  it('saves only what the mode picked holds', () => {
    const both: EventTimeDraft = { ...years('1500', '', true), chapter: REVERIE };

    expect(eventTimeSaved(both)).toEqual({
      worldDate: { yearFrom: 1500, yearTo: null, approximate: true },
    });
    expect(eventTimeSaved({ ...both, mode: 'chapter' })).toEqual({ chapter: 'c908' });
  });

  it('saves nothing while the mode picked has nothing, or the first year is no year', () => {
    expect(eventTimeSaved(EMPTY_EVENT_TIME)).toBeNull();
    expect(eventTimeSaved(years(' ', '800'))).toBeNull();
    expect(eventTimeSaved(years('-5'))).toBeNull();
    expect(isEventTimeFilled(years(''))).toBe(false);
    expect(isEventTimeFilled(years('1498'))).toBe(true);
    expect(isEventTimeFilled({ chapter: REVERIE })).toBe(true);
    expect(isEventTimeFilled(null)).toBe(false);
  });

  it.each([
    [{ yearFrom: 1498, yearTo: null, approximate: false }, '1498'],
    [{ yearFrom: 1500, yearTo: null, approximate: true }, 'c. 1500'],
    [{ yearFrom: 700, yearTo: 800, approximate: true }, 'c. 700–800'],
    [{ yearFrom: 1500, yearTo: 1500, approximate: false }, '1500'],
  ])('writes %o as %s', (date, text) => {
    expect(worldDateText(date)).toBe(text);
  });

  it('counts the years before the story begins, from 1522', () => {
    expect(yearsBeforeStory({ yearFrom: 1498, yearTo: null, approximate: false })).toBe('24');
    expect(yearsBeforeStory({ yearFrom: 700, yearTo: 800, approximate: true })).toBe('722–822');
    expect(yearsBeforeStory({ yearFrom: 1522, yearTo: null, approximate: false })).toBeNull();
    expect(yearsBeforeStory({ yearFrom: 1500, yearTo: 1522, approximate: false })).toBe('22');
  });

  it('is compared by its chapter or its world date', () => {
    expect(eventTimeText({ chapter: REVERIE })).toBe('908 — The Reverie');
    expect(eventTimeText({ worldDate: { yearFrom: 700, yearTo: 800, approximate: true } })).toBe(
      'c. 700–800',
    );
    expect(eventTimeText(years('1498'))).toBe('1498');
    expect(eventTimeText(EMPTY_EVENT_TIME)).toBeNull();
    expect(eventTimeText(null)).toBeNull();
  });

  describe('checked before saving', () => {
    it('refuses a span ending before it starts', () => {
      expect(eventTimeProblem(years('800', '700'))).toBe('yearsOutOfOrder');
    });

    it('refuses a year after the story starts', () => {
      expect(eventTimeProblem(years('1523'))).toBe('afterStoryStart');
      expect(eventTimeProblem(years('1500', '1530'))).toBe('afterStoryStart');
      expect(eventTimeProblem(years('1522'))).toBeNull();
    });

    it('refuses an end before its start', () => {
      expect(eventTimeProblem(inChapter(REVERIE), inChapter(ONIGASHIMA))).toBe('beforeStart');
      expect(eventTimeProblem(years('1400'), years('1500'))).toBe('beforeStart');
      expect(eventTimeProblem(inChapter(ONIGASHIMA), { chapter: REVERIE })).toBeNull();
      expect(eventTimeProblem(inChapter(REVERIE), years('1500'))).toBeNull();
    });

    it('never ends in a year what happens in a chapter', () => {
      expect(eventTimeProblem(years('1500'), inChapter(REVERIE))).toBe('yearAfterChapter');
    });

    it('lets overlapping or unknown years through: only a certain order is wrong', () => {
      expect(eventTimeProblem(years('1500', '1510'), years('1505'))).toBeNull();
      expect(eventTimeProblem(years('1500'), EMPTY_EVENT_TIME)).toBeNull();
    });
  });

  it.each([
    ['occursAt.worldDate.yearFrom', 'afterStoryStart'],
    ['endsAt.worldDate.yearTo', 'afterStoryStart'],
    ['endsAt.worldDate', 'yearsOutOfOrder'],
    ['occursAt.chapter', 'notLinkable'],
    ['endsAt', 'beforeStart'],
    ['endsAt.other', null],
  ])('reads the refusal of %s as %s', (path, refusal) => {
    expect(eventTimeRefusal(path, path.split('.')[0])).toBe(refusal);
  });
});
