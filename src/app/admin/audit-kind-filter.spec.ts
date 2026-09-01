import { TestBed } from '@angular/core/testing';
import { AuditKindFilter } from './audit-kind-filter';

describe('AuditKindFilter', () => {
  it('summarizes as "All types" when nothing is selected', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set());
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('All types');
  });

  it('summarizes a single selection by its label', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set(['USER_INVITED']));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Invited User');
  });

  it('summarizes multiple selections by count', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set(['USER_INVITED', 'ROLE_ASSIGNED']));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('2 types selected');
  });

  it('lists every real audit action, checking the ones already selected', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set(['USER_INVITED']));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const menuOptions = root.querySelector('[popover]')!.querySelectorAll('button');
    expect(Array.from(menuOptions).some((b) => b.textContent?.includes('Revoked Access'))).toBe(
      true,
    );
    const invitedOption = Array.from(menuOptions).find((b) =>
      b.textContent?.includes('Invited User'),
    );
    expect(invitedOption?.getAttribute('aria-pressed')).toBe('true');
    const revokedOption = Array.from(menuOptions).find((b) =>
      b.textContent?.includes('Revoked Access'),
    );
    expect(revokedOption?.getAttribute('aria-pressed')).toBe('false');
  });

  it('filters the list by a case-insensitive substring of the label as you type', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set());
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('input') as HTMLInputElement;
    searchInput.value = 'ROLE';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const optionLabels = Array.from(
      root.querySelector('[popover]')!.querySelectorAll('button'),
    ).map((b) => b.textContent?.trim());
    expect(optionLabels).toEqual(['Granted Role', 'Revoked Role', 'Created Role', 'Deleted Role']);
  });

  it('shows a "no matching types" message when the search matches nothing', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set());
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('input') as HTMLInputElement;
    searchInput.value = 'zzz not a type';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(root.querySelector('[popover]')!.querySelectorAll('button').length).toBe(0);
    expect(root.textContent).toContain('No matching types.');
  });

  it('resets the search once the menu is closed and reopened', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set());
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('input') as HTMLInputElement;
    searchInput.value = 'ROLE';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    trigger.click(); // close
    fixture.detectChanges();
    trigger.click(); // reopen
    fixture.detectChanges();

    const reopenedSearchInput = root.querySelector('input') as HTMLInputElement;
    expect(reopenedSearchInput.value).toBe('');
    expect(root.querySelector('[popover]')!.querySelectorAll('button').length).toBe(12);
  });

  it('does not leave the popover host visible after closing (no forced display utility on it)', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set());
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

  it('emits the toggled action key', () => {
    const fixture = TestBed.createComponent(AuditKindFilter);
    fixture.componentRef.setInput('selected', new Set());
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const toggledSpy = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggledSpy);

    const root = fixture.nativeElement as HTMLElement;
    const invitedOption = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Invited User'),
    );
    invitedOption!.click();

    expect(toggledSpy).toHaveBeenCalledWith('USER_INVITED');
  });
});
