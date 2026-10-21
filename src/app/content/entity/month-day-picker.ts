import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MONTHS, daysIn, monthName, type MonthDayDraft } from './entity-month-day';

/** The most days a month has: what the day select offers before a month is picked. */
const MOST_DAYS = 31;

/**
 * A day of the year without a year - a birthday - picked as a day and a month, the months
 * named in the interface's language. The days offered are those of the month picked (29 for
 * February), so the pair is always a real day; a month with fewer days drops a day it lacks.
 */
@Component({
  selector: 'app-month-day-picker',
  templateUrl: './month-day-picker.html',
  imports: [TranslocoPipe],
})
export class MonthDayPicker {
  private readonly transloco = inject(TranslocoService);

  /** The id of the day select, for the field's label; the month's is the same plus `-month`. */
  readonly inputId = input.required<string>();
  readonly value = input.required<MonthDayDraft>();
  readonly invalid = input(false);
  readonly picked = output<MonthDayDraft>();

  protected readonly days = computed(() => {
    const month = Number(this.value().month);
    return Array.from({ length: month ? daysIn(month) : MOST_DAYS }, (_, index) =>
      String(index + 1),
    );
  });

  protected readonly months = computed(() => {
    const language = this.transloco.activeLang();
    return MONTHS.map((month) => ({ value: String(month), name: monthName(month, language) }));
  });

  protected pickDay(day: string): void {
    this.picked.emit({ ...this.value(), day });
  }

  protected pickMonth(month: string): void {
    const day = Number(this.value().day);
    const kept = month && day > daysIn(Number(month)) ? '' : this.value().day;
    this.picked.emit({ month, day: kept });
  }
}
