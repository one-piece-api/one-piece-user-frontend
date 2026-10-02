import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { ContentListToolbar } from './content-list-toolbar';
import type { VersionStatus } from './content.model';

describe('ContentListToolbar', () => {
  let fixture: ComponentFixture<ContentListToolbar>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(ContentListToolbar);
    fixture.componentRef.setInput('query', '');
    fixture.componentRef.setInput('status', null);
    fixture.componentRef.setInput('author', null);
    fixture.componentRef.setInput('updatedWithinDays', null);
    fixture.componentRef.setInput('statusOptions', ['IN_REVIEW', 'PUBLISHED']);
    fixture.componentRef.setInput('otherAuthors', [
      { id: 'u2', username: 'chopper', email: 'chopper@onepiece.local' },
    ]);
    fixture.componentRef.setInput('myUsername', 'zoro');
    fixture.componentRef.setInput('resultLine', '3 of 20 entries · 0 yours');
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  function selects(): HTMLSelectElement[] {
    return Array.from(root.querySelectorAll('select'));
  }

  function optionLabels(select: HTMLSelectElement): string[] {
    return Array.from(select.options).map((option) => option.textContent?.trim() ?? '');
  }

  function choose(select: HTMLSelectElement, value: string): void {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  it('offers only the statuses it was given, after "all statuses"', () => {
    expect(optionLabels(selects()[0])).toEqual(['All statuses', 'In review', 'Published']);
  });

  it('offers everyone, the caller as "You", then the other authors', () => {
    expect(optionLabels(selects()[1])).toEqual(['Everyone', 'You', 'chopper']);
  });

  it('offers the four "updated" ranges', () => {
    expect(optionLabels(selects()[2])).toEqual([
      'Any time',
      'Today',
      'Last 7 days',
      'Last 30 days',
    ]);
  });

  it('shows the result line and the current filters', () => {
    fixture.componentRef.setInput('query', 'zoan');
    fixture.componentRef.setInput('status', 'PUBLISHED');
    fixture.componentRef.setInput('author', 'zoro');
    fixture.componentRef.setInput('updatedWithinDays', 7);
    fixture.detectChanges();

    expect(root.textContent).toContain('3 of 20 entries · 0 yours');
    expect((root.querySelector('input') as HTMLInputElement).value).toBe('zoan');
    expect(selects().map((select) => select.value)).toEqual(['PUBLISHED', 'zoro', '7']);
  });

  it('reports a chosen status, and null for "all statuses"', () => {
    const chosen: (VersionStatus | null)[] = [];
    fixture.componentInstance.statusChange.subscribe((status) => chosen.push(status));

    choose(selects()[0], 'PUBLISHED');
    choose(selects()[0], '');

    expect(chosen).toEqual(['PUBLISHED', null]);
  });

  it('reports the caller as author by their username when "You" is chosen', () => {
    const chosen: (string | null)[] = [];
    fixture.componentInstance.authorChange.subscribe((author) => chosen.push(author));

    choose(selects()[1], 'zoro');
    choose(selects()[1], '');

    expect(chosen).toEqual(['zoro', null]);
  });

  it('reports the number of days, zero included, and null for "any time"', () => {
    const chosen: (number | null)[] = [];
    fixture.componentInstance.updatedWithinDaysChange.subscribe((days) => chosen.push(days));

    choose(selects()[2], '0');
    choose(selects()[2], '30');
    choose(selects()[2], '');

    expect(chosen).toEqual([0, 30, null]);
  });

  it('reports what is typed in the search box and the reset', () => {
    const typed: string[] = [];
    let cleared = 0;
    fixture.componentInstance.queryChange.subscribe((text) => typed.push(text));
    fixture.componentInstance.cleared.subscribe(() => cleared++);

    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'logia';
    input.dispatchEvent(new Event('input'));
    (root.querySelector('button') as HTMLButtonElement).click();

    expect(typed).toEqual(['logia']);
    expect(cleared).toBe(1);
  });
});
