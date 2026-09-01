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
    expect(Array.from(menuOptions).some((b) => b.textContent?.includes('Revoked Access'))).toBe(true);
    const invitedOption = Array.from(menuOptions).find((b) => b.textContent?.includes('Invited User'));
    expect(invitedOption?.getAttribute('aria-pressed')).toBe('true');
    const revokedOption = Array.from(menuOptions).find((b) => b.textContent?.includes('Revoked Access'));
    expect(revokedOption?.getAttribute('aria-pressed')).toBe('false');
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
