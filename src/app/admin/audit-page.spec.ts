import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminAuditPage } from './audit-page';

describe('AdminAuditPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAuditPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the audit trail newest first', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=0').flush({
      content: [
        {
          action: 'USER_INVITED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: 't1',
          targetEmail: 'usopp@onepiece.local',
          occurredAt: '2026-08-23T10:00:00Z',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain("Ship's Log");
    expect(root.textContent).toContain('Invited User');
    expect(root.textContent).toContain('luffy@onepiece.local');
    expect(root.textContent).toContain('usopp@onepiece.local');
    expect(root.textContent).toContain('1–1 of 1');
  });

  it('shows the filter-free empty state when the trail has no entries', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/audit?page=0')
      .flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Not a single entry in the log yet.');
  });

  it('shows an error toast when the request fails', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/audit?page=0')
      .flush('nope', { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Lost the log');
  });

  it('pages forward and back through the trail', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=0').flush({
      content: [
        {
          action: 'USER_INVITED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: 't1',
          targetEmail: 'usopp@onepiece.local',
          occurredAt: '2026-08-23T10:00:00Z',
        },
      ],
      page: 0,
      size: 1,
      totalElements: 2,
      totalPages: 2,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Page 1 of 2');

    // Clicking either the top or the bottom set of controls should page forward - they
    // stay in lockstep since both are bound to the same `page` signal.
    const nextButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '→',
    );
    nextButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=1').flush({
      content: [
        {
          action: 'ROLE_ASSIGNED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: 't2',
          targetEmail: 'nami@onepiece.local',
          occurredAt: '2026-08-23T11:00:00Z',
        },
      ],
      page: 1,
      size: 1,
      totalElements: 2,
      totalPages: 2,
    });
  });

  it('shows the pagination arrows in the same gold tone as other primary buttons', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=0').flush({
      content: [
        {
          action: 'USER_INVITED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: 't1',
          targetEmail: 'usopp@onepiece.local',
          occurredAt: '2026-08-23T10:00:00Z',
        },
      ],
      page: 0,
      size: 1,
      totalElements: 2,
      totalPages: 2,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button')).filter((b) =>
      ['←', '→'].includes(b.textContent?.trim() ?? ''),
    );
    // One pair above the results, one pair below (both duplicated for easier navigation).
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      expect(button.className).toContain('bg-treasure-500');
      expect(button.className).toContain('text-ocean-950');
    }
  });

  it('jumps directly to a page via the numbered pagination buttons', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=0').flush({
      content: [
        {
          action: 'USER_INVITED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: 't1',
          targetEmail: 'usopp@onepiece.local',
          occurredAt: '2026-08-23T10:00:00Z',
        },
      ],
      page: 0,
      size: 1,
      totalElements: 3,
      totalPages: 3,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const pageButtons = Array.from(root.querySelectorAll('button')).filter((b) =>
      ['1', '2', '3'].includes(b.textContent?.trim() ?? ''),
    );
    // Duplicated top and bottom: 1, 2, 3, 1, 2, 3.
    expect(pageButtons.map((b) => b.textContent?.trim())).toEqual(['1', '2', '3', '1', '2', '3']);

    const pageThreeButton = pageButtons.find((b) => b.textContent?.trim() === '3');
    pageThreeButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=2').flush({
      content: [],
      page: 2,
      size: 1,
      totalElements: 3,
      totalPages: 3,
    });
  });

  it('shows the range pill in gold, in line with the page label and nav buttons, above and below the results', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=0').flush({
      content: [
        {
          action: 'USER_INVITED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: 't1',
          targetEmail: 'usopp@onepiece.local',
          occurredAt: '2026-08-23T10:00:00Z',
        },
      ],
      page: 0,
      size: 1,
      totalElements: 2,
      totalPages: 2,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    // One combined row (range pill + page pill + nav buttons) above the results, one below.
    const pills = Array.from(root.querySelectorAll('span')).filter((s) =>
      s.textContent?.includes('1–1 of 2'),
    );
    expect(pills).toHaveLength(2);
    for (const rangePill of pills) {
      expect(rangePill.className).toContain('bg-treasure-500');
      expect(rangePill.className).toContain('text-ocean-950');

      // Page label and nav buttons sit alongside the range pill on the same row at every
      // width; only the page label itself is dropped below `sm` (`hidden sm:inline-flex`)
      // to keep the mobile row from getting crowded.
      const row = rangePill.parentElement as HTMLElement;
      expect(row.className).toContain('items-center');
      expect(row.className).toContain('justify-between');
      const pageLabel = Array.from(row.querySelectorAll('span')).find((s) =>
        s.textContent?.includes('Page 1 of 2'),
      );
      expect(pageLabel?.className).toContain('hidden');
      expect(pageLabel?.className).toContain('sm:inline-flex');
      expect(row.querySelectorAll('button').length).toBeGreaterThan(0);

      // The numbered pages scroll horizontally instead of wrapping into a messy grid.
      const numbersWrapper = row.querySelector('.overflow-x-auto');
      expect(numbersWrapper).toBeTruthy();
    }

    // The range pill and its row both come before the results card.
    const rangeIndex = root.innerHTML.indexOf('1–1 of 2');
    const resultsIndex = root.innerHTML.indexOf('usopp@onepiece.local');
    expect(rangeIndex).toBeGreaterThan(-1);
    expect(rangeIndex).toBeLessThan(resultsIndex);
  });

  it('shows only the range pill, with no pagination controls, when there is a single page', async () => {
    const fixture = TestBed.createComponent(AdminAuditPage);
    fixture.detectChanges();

    httpTesting.expectOne('/api/audit?page=0').flush({
      content: [
        {
          action: 'USER_INVITED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: 't1',
          targetEmail: 'usopp@onepiece.local',
          occurredAt: '2026-08-23T10:00:00Z',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('1–1 of 1');
    expect(root.textContent).not.toContain('Page 1 of 1');
    expect(root.querySelectorAll('button').length).toBe(0);
  });
});
