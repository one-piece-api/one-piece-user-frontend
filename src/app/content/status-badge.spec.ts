import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import type { VersionStatus } from './content.model';
import { STATUS_BORDER_CLASS, StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
  });

  function render(status: VersionStatus, prominent = false): HTMLElement {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('prominent', prominent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['DRAFT', 'Draft'],
    ['IN_REVIEW', 'In review'],
    ['REJECTED', 'Rejected'],
    ['READY_TO_PUBLISH', 'Ready to publish'],
    ['PUBLISHED', 'Published'],
    ['ARCHIVED', 'Archived'],
    ['RETIRED', 'Retired'],
    ['SUPERSEDED', 'Superseded'],
  ] as const)('names %s as "%s"', (status, label) => {
    expect(render(status).textContent?.trim()).toBe(label);
  });

  it('colors the pill and its dot after the status', () => {
    const pill = render('PUBLISHED').querySelector('span') as HTMLElement;

    expect(pill.className).toContain('bg-status-published-soft');
    expect(pill.className).toContain('text-status-published-ink');
    expect(pill.querySelector('span')?.className).toContain('bg-status-published-accent');
  });

  it('leads with the glyph of the status, not a dot, when prominent', () => {
    const pill = render('PUBLISHED', true).querySelector('span') as HTMLElement;

    expect(pill.textContent).toContain('⚓');
    expect(pill.textContent).toContain('Published');
    expect(pill.querySelector('.bg-status-published-accent')).toBeNull();
  });

  it('has a border color for every status', () => {
    expect(STATUS_BORDER_CLASS.REJECTED).toBe('border-l-status-rejected-accent');
    expect(Object.keys(STATUS_BORDER_CLASS).length).toBe(8);
  });
});
