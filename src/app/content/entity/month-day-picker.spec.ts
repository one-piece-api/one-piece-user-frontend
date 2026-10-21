import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import type { MonthDayDraft } from './entity-month-day';
import { MonthDayPicker } from './month-day-picker';

describe('MonthDayPicker', () => {
  let fixture: ComponentFixture<MonthDayPicker>;
  let root: HTMLElement;
  let picked: MonthDayDraft[];

  function render(value: MonthDayDraft): void {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(MonthDayPicker);
    fixture.componentRef.setInput('inputId', 'draft-birthday');
    fixture.componentRef.setInput('value', value);
    picked = [];
    fixture.componentInstance.picked.subscribe((day) => picked.push(day));
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function select(testId: string): HTMLSelectElement {
    return root.querySelector(`[data-testid="${testId}"]`) as HTMLSelectElement;
  }

  function choose(testId: string, value: string): void {
    const box = select(testId);
    box.value = value;
    box.dispatchEvent(new Event('change'));
  }

  /** The values offered, without the empty choice. */
  function offered(testId: string): string[] {
    return [...select(testId).options].map(({ value }) => value).filter(Boolean);
  }

  it('offers the days of the month picked, 29 for February', () => {
    render({ month: '2', day: '' });

    expect(offered('month-day-day')).toHaveLength(29);
    expect(offered('month-day-month')).toHaveLength(12);
  });

  it('offers every day before a month is picked', () => {
    render({ month: '', day: '' });

    expect(offered('month-day-day')).toHaveLength(31);
  });

  it('names the months in the interface language', () => {
    render({ month: '7', day: '3' });
    expect(select('month-day-month').selectedOptions[0].textContent?.trim()).toBe('July');

    TestBed.inject(TranslocoService).setActiveLang('it');
    fixture.detectChanges();
    expect(select('month-day-month').selectedOptions[0].textContent?.trim()).toBe('luglio');
    expect(select('month-day-day').value).toBe('3');
  });

  it('gives back the day picked with the month already there', () => {
    render({ month: '7', day: '' });

    choose('month-day-day', '3');

    expect(picked).toEqual([{ month: '7', day: '3' }]);
  });

  it('drops a day the month picked does not have, and keeps one it has', () => {
    render({ month: '1', day: '31' });

    choose('month-day-month', '4');
    choose('month-day-month', '3');

    expect(picked).toEqual([
      { month: '4', day: '' },
      { month: '3', day: '31' },
    ]);
  });
});
