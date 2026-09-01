import { TestBed } from '@angular/core/testing';
import { formatIsoDateDisplay } from '../shared/ui/date-picker';
import { AuditFilters } from './audit-filters';

const FROM_LABEL = formatIsoDateDisplay('2026-08-01');
const TO_LABEL = formatIsoDateDisplay('2026-08-31');

describe('AuditFilters', () => {
  function create(overrides: {
    selectedActions?: ReadonlySet<string>;
    actorEmail?: string;
    actorOptions?: string[];
    dateFrom?: string | null;
    dateTo?: string | null;
  }) {
    const fixture = TestBed.createComponent(AuditFilters);
    fixture.componentRef.setInput('selectedActions', overrides.selectedActions ?? new Set());
    fixture.componentRef.setInput('actorEmail', overrides.actorEmail ?? '');
    fixture.componentRef.setInput('actorOptions', overrides.actorOptions ?? []);
    fixture.componentRef.setInput('dateFrom', overrides.dateFrom ?? null);
    fixture.componentRef.setInput('dateTo', overrides.dateTo ?? null);
    fixture.detectChanges();
    return fixture;
  }

  it('shows no active-filter chips when nothing is selected', () => {
    const fixture = create({});
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toContain('Active filters');
  });

  it('lists the author dropdown options plus "Everyone"', () => {
    const fixture = create({ actorOptions: ['luffy@onepiece.local', 'nami@onepiece.local'] });
    const root = fixture.nativeElement as HTMLElement;
    const options = Array.from(root.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Everyone', 'luffy@onepiece.local', 'nami@onepiece.local']);
  });

  it('emits actorEmailChange when the author select changes', () => {
    const fixture = create({ actorOptions: ['luffy@onepiece.local'] });
    const spy = vi.fn();
    fixture.componentInstance.actorEmailChange.subscribe(spy);

    const select = fixture.nativeElement.querySelector('#audit-author') as HTMLSelectElement;
    select.value = 'luffy@onepiece.local';
    select.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith('luffy@onepiece.local');
  });

  it('renders one removable chip per active filter, cumulatively', () => {
    const fixture = create({
      selectedActions: new Set(['USER_INVITED']),
      actorEmail: 'nami@onepiece.local',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Active filters');
    expect(root.textContent).toContain('Type: Invited User');
    expect(root.textContent).toContain('Author: nami@onepiece.local');
    expect(root.textContent).toContain(`${FROM_LABEL} – ${TO_LABEL}`);
  });

  it('removes only the author filter when its chip is clicked', () => {
    const fixture = create({
      selectedActions: new Set(['USER_INVITED']),
      actorEmail: 'nami@onepiece.local',
    });
    const actionToggledSpy = vi.fn();
    const actorEmailChangeSpy = vi.fn();
    fixture.componentInstance.actionToggled.subscribe(actionToggledSpy);
    fixture.componentInstance.actorEmailChange.subscribe(actorEmailChangeSpy);

    const root = fixture.nativeElement as HTMLElement;
    const authorChip = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Author: nami@onepiece.local'),
    );
    authorChip!.click();

    expect(actorEmailChangeSpy).toHaveBeenCalledWith('');
    expect(actionToggledSpy).not.toHaveBeenCalled();
  });

  it('removes both ends of the date range together from its one combined chip', () => {
    const fixture = create({ dateFrom: '2026-08-01', dateTo: '2026-08-31' });
    const dateFromChangeSpy = vi.fn();
    const dateToChangeSpy = vi.fn();
    fixture.componentInstance.dateFromChange.subscribe(dateFromChangeSpy);
    fixture.componentInstance.dateToChange.subscribe(dateToChangeSpy);

    const root = fixture.nativeElement as HTMLElement;
    const dateChip = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(`${FROM_LABEL} – ${TO_LABEL}`),
    );
    dateChip!.click();

    expect(dateFromChangeSpy).toHaveBeenCalledWith(null);
    expect(dateToChangeSpy).toHaveBeenCalledWith(null);
  });

  it('emits cleared when "Clear all" is clicked', () => {
    const fixture = create({ actorEmail: 'nami@onepiece.local' });
    const clearedSpy = vi.fn();
    fixture.componentInstance.cleared.subscribe(clearedSpy);

    const root = fixture.nativeElement as HTMLElement;
    const clearAllButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Clear all',
    );
    clearAllButton!.click();

    expect(clearedSpy).toHaveBeenCalled();
  });
});
