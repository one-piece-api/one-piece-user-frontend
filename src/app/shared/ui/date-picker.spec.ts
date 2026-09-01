import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { DatePicker, formatIsoDateDisplay } from './date-picker';

/** Mirrors the component's own month-label formatting - 'en', matching the testing
 * catalog's `defaultLang` (`i18n-testing.ts`), not the OS/CI runner's own locale. */
function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

describe('DatePicker', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
  });

  it('shows a placeholder when no date is selected', () => {
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('label', 'From');
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('From');
    expect(root.textContent).toContain('dd/mm/yyyy');
  });

  it('displays the selected date in the viewer locale', () => {
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('value', '2026-08-23');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain(formatIsoDateDisplay('2026-08-23', 'en'));
  });

  it('opens the calendar and emits the picked day', () => {
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('value', '2026-08-23');
    fixture.detectChanges();

    const valueChangeSpy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChangeSpy);

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector('button')!.click();
    fixture.detectChanges();

    expect(root.textContent).toContain(monthLabel(2026, 8));
    const dayFifteen = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '15',
    );
    dayFifteen!.click();

    expect(valueChangeSpy).toHaveBeenCalledWith('2026-08-15');
  });

  it('navigates between months without changing the selected value', () => {
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('value', '2026-08-23');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const nextMonthButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '›',
    );
    nextMonthButton!.click();
    fixture.detectChanges();

    expect(root.textContent).toContain(monthLabel(2026, 9));
  });

  it('disables every day after today - audit events can never be dated in the future', () => {
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'));
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('value', '2026-08-23');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const valueChangeSpy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChangeSpy);

    const root = fixture.nativeElement as HTMLElement;
    const dayButtons = Array.from(root.querySelectorAll('button'));
    const dayTwentyFour = dayButtons.find((b) => b.textContent?.trim() === '24');
    const dayTwentyThree = dayButtons.find((b) => b.textContent?.trim() === '23');

    expect(dayTwentyFour!.disabled).toBe(true);
    expect(dayTwentyThree!.disabled).toBe(false);

    dayTwentyFour!.click();
    expect(valueChangeSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('disables navigating past the current month', () => {
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'));
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('value', '2026-08-01');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const nextMonthButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '›',
    );
    expect(nextMonthButton!.disabled).toBe(true);

    nextMonthButton!.click();
    fixture.detectChanges();
    expect(root.textContent).toContain(monthLabel(2026, 8));
    vi.useRealTimers();
  });

  it("emits today's date and null on Today/Clear", () => {
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'));
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('value', '2026-08-01');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const valueChangeSpy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChangeSpy);

    const root = fixture.nativeElement as HTMLElement;
    const todayButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Today',
    );
    todayButton!.click();
    expect(valueChangeSpy).toHaveBeenCalledWith('2026-08-23');

    const clearButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Clear',
    );
    clearButton!.click();
    expect(valueChangeSpy).toHaveBeenCalledWith(null);
    vi.useRealTimers();
  });

  it('positions the popover from the right edge when aligned "end"', () => {
    const fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('align', 'end');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('[popover]') as HTMLElement;
    expect(popover.style.left).toBe('auto');
    expect(popover.style.right).not.toBe('');
  });

  it('positions the popover from the left edge by default', () => {
    const fixture = TestBed.createComponent(DatePicker);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('[popover]') as HTMLElement;
    expect(popover.style.right).toBe('auto');
    expect(popover.style.left).not.toBe('');
  });

  it('does not leave the popover host visible after closing (no forced display utility on it)', () => {
    const fixture = TestBed.createComponent(DatePicker);
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();
    trigger.click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('[popover]') as HTMLElement;
    // A `display` utility (flex/grid/block) applied directly to the `[popover]` host
    // would override the browser's own `display: none` on close - author styles beat
    // the user-agent stylesheet regardless of popover state - leaving an empty box
    // visible. The flex/grid layout must live on an inner wrapper instead.
    expect(popover.className).not.toMatch(/(^|\s)(flex|grid|block|inline)(\s|$)/);
  });
});
