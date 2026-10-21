/**
 * A day of the year without a year - a character's birthday - as the API sends it (ISO 8601
 * `--MM-DD`, Java's `MonthDay`) and as the editor holds it, a month and a day picked apart.
 * No Angular in here.
 */

/** A day being picked: each part as the select's value, `''` while not picked. */
export interface MonthDayDraft {
  readonly month: string;
  readonly day: string;
}

/** The months, 1 to 12. */
export const MONTHS: readonly number[] = Array.from({ length: 12 }, (_, index) => index + 1);

/** A leap year, so that 29 February is a real day, as it is for `MonthDay`. */
const LEAP_YEAR = 2000;

/** `--MM-DD`: two digits each. */
const MONTH_DAY = /^--(\d{2})-(\d{2})$/;

/** How many days a month may have - 29 for February. */
export function daysIn(month: number): number {
  return new Date(Date.UTC(LEAP_YEAR, month, 0)).getUTCDate();
}

/** Whether a month and a day make a real day of the year. */
function isRealDay(month: number, day: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(month);
}

/**
 * The month and the day of a value - `--MM-DD` read from the API, or a draft already - each
 * `''` where there is none, or where the value is not a real day.
 */
export function monthDayOf(value: unknown): MonthDayDraft {
  if (typeof value === 'string') {
    const [, month, day] = MONTH_DAY.exec(value) ?? [];
    return month && isRealDay(Number(month), Number(day))
      ? { month: String(Number(month)), day: String(Number(day)) }
      : { month: '', day: '' };
  }
  if (typeof value === 'object' && value !== null) {
    const { month, day } = value as Partial<MonthDayDraft>;
    return {
      month: typeof month === 'string' ? month : '',
      day: typeof day === 'string' ? day : '',
    };
  }
  return { month: '', day: '' };
}

/** `--MM-DD` for a month and a day that make a real day; `null` otherwise - nothing to send. */
export function monthDayText({ month, day }: MonthDayDraft): string | null {
  const m = Number(month);
  const d = Number(day);
  if (!month || !day || !isRealDay(m, d)) {
    return null;
  }
  return `--${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "3 luglio", "July 3": a `--MM-DD` in `language`, without a year; the value as is otherwise. */
export function monthDayLabel(value: string, language: string): string {
  const { month, day } = monthDayOf(value);
  if (!month) {
    return value;
  }
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(Date.UTC(LEAP_YEAR, Number(month) - 1, Number(day)));
}

/** The name of a month in `language`: "luglio", "July". */
export function monthName(month: number, language: string): string {
  return new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(
    Date.UTC(LEAP_YEAR, month - 1, 1),
  );
}
