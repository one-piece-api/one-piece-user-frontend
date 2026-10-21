import { daysIn, monthDayLabel, monthDayOf, monthDayText, monthName } from './entity-month-day';
import { FIELD_KINDS } from './field-kinds';

describe('a day of the year', () => {
  it('has 29 days in February, as a MonthDay does', () => {
    expect(daysIn(2)).toBe(29);
    expect(daysIn(4)).toBe(30);
    expect(daysIn(12)).toBe(31);
  });

  it('is read from --MM-DD, 29 February included, and nothing from a day that is not real', () => {
    expect(monthDayOf('--05-05')).toEqual({ month: '5', day: '5' });
    expect(monthDayOf('--02-29')).toEqual({ month: '2', day: '29' });
    expect(monthDayOf('--02-30')).toEqual({ month: '', day: '' });
    expect(monthDayOf('2026-05-05')).toEqual({ month: '', day: '' });
    expect(monthDayOf(null)).toEqual({ month: '', day: '' });
  });

  it('keeps a draft as it is', () => {
    expect(monthDayOf({ month: '7', day: '' })).toEqual({ month: '7', day: '' });
  });

  it('is written as --MM-DD only once both parts make a real day', () => {
    expect(monthDayText({ month: '7', day: '3' })).toBe('--07-03');
    expect(monthDayText({ month: '2', day: '29' })).toBe('--02-29');
    expect(monthDayText({ month: '2', day: '30' })).toBeNull();
    expect(monthDayText({ month: '7', day: '' })).toBeNull();
    expect(monthDayText({ month: '', day: '3' })).toBeNull();
  });

  it('is named without a year in the reader language', () => {
    expect(monthDayLabel('--07-03', 'it')).toBe('3 luglio');
    expect(monthDayLabel('--07-03', 'en')).toBe('July 3');
    expect(monthDayLabel('--02-29', 'en')).toBe('February 29');
    expect(monthName(12, 'it')).toBe('dicembre');
  });
});

describe('the monthDay field kind', () => {
  const strategy = FIELD_KINDS.monthDay;

  it('is kept on the version and never asked for by review', () => {
    expect(strategy.localized).toBe(false);
    expect(strategy.forReview).toBe(false);
  });

  it('gives the editor the parts of a saved day, and saves --MM-DD or null', () => {
    expect(strategy.draftValue('--05-05')).toEqual({ month: '5', day: '5' });
    expect(strategy.savedValue({ month: '5', day: '5' })).toBe('--05-05');
    expect(strategy.savedValue({ month: '5', day: '' })).toBeNull();
    expect(strategy.savedValue(undefined)).toBeNull();
  });

  it('counts as filled with a real day, saved or picked', () => {
    expect(strategy.isFilled('--02-29')).toBe(true);
    expect(strategy.isFilled({ month: '2', day: '29' })).toBe(true);
    expect(strategy.isFilled({ month: '2', day: '' })).toBe(false);
  });

  it('compares the days as --MM-DD, leaving out a day absent on both sides', () => {
    expect(strategy.diff('f', '--05-05', '--05-06')).toMatchObject({
      before: '--05-05',
      after: '--05-06',
      change: 'MODIFIED',
    });
    expect(strategy.diff('f', null, '--05-05')?.change).toBe('ADDED');
    expect(strategy.diff('f', null, undefined)).toBeNull();
  });
});
