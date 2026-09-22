import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MascotService } from '../shared/mascot/mascot';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { ReviewQueue } from './review-queue';

// jsdom doesn't implement <dialog>'s showModal()/close() yet - every real browser this app
// targets does, so this is purely a test-environment gap.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

describe('ReviewQueue', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewQueue, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushMe(email: string): void {
    httpTesting.expectOne('/api/me').flush({
      username: 'reviewer',
      email,
      roles: ['REVIEWER'],
      permissions: ['content:review'],
    });
  }

  const queueItem = {
    id: 'q1',
    itemId: 'i1',
    entityType: 'DEVIL_FRUIT_TYPE',
    romaji: 'Paramishia',
    displayName: 'Paramecia',
    authorEmail: 'editor-a@onepiece.local',
    claimedByEmail: null as string | null,
    updatedAt: '2026-09-22T10:00:00Z',
  };

  function detailFor(claimedByEmail: string | null) {
    return {
      id: 'q1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'IN_REVIEW',
      translations: {
        it: { name: 'Paramecia', description: 'Descrizione IT' },
        en: { name: 'Paramecia', description: 'EN description' },
      },
      updatedAt: '2026-09-22T10:00:00Z',
      authorEmail: 'editor-a@onepiece.local',
      claimedByEmail,
      rejectionReason: null as string | null,
    };
  }

  it("lists every author's queued items", async () => {
    const fixture = TestBed.createComponent(ReviewQueue);
    fixture.detectChanges();
    flushMe('reviewer-a@onepiece.local');
    httpTesting.expectOne('/api/content/review-queue').flush([queueItem]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Paramecia');
    expect(root.textContent).toContain('editor-a@onepiece.local');
  });

  async function selectItem(
    fixture: ReturnType<typeof TestBed.createComponent<ReviewQueue>>,
    viewerEmail: string,
    claimedByEmail: string | null,
  ): Promise<HTMLElement> {
    fixture.detectChanges();
    flushMe(viewerEmail);
    httpTesting.expectOne('/api/content/review-queue').flush([{ ...queueItem, claimedByEmail }]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const row = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Paramecia'),
    );
    row?.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/review-queue/q1').flush(detailFor(claimedByEmail));
    await fixture.whenStable();
    fixture.detectChanges();
    return root;
  }

  it('an unclaimed item shows a claim button, which claims it', async () => {
    const fixture = TestBed.createComponent(ReviewQueue);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectItem(fixture, 'reviewer-a@onepiece.local', null);

    const claimButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Claim',
    );
    claimButton!.click();
    fixture.detectChanges();

    const claimReq = httpTesting.expectOne('/api/content/devil-fruit-types/q1/claim');
    expect(claimReq.request.method).toBe('POST');
    claimReq.flush(detailFor('reviewer-a@onepiece.local'));
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/content/review-queue/q1')
      .flush(detailFor('reviewer-a@onepiece.local'));
    httpTesting
      .expectOne('/api/content/review-queue')
      .flush([{ ...queueItem, claimedByEmail: 'reviewer-a@onepiece.local' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(expect.objectContaining({ tone: 'success' }));
    expect(root.textContent).toContain('Release');
  });

  it('an item claimed by someone else shows who, with no action buttons', async () => {
    const fixture = TestBed.createComponent(ReviewQueue);
    const root = await selectItem(
      fixture,
      'reviewer-a@onepiece.local',
      'reviewer-b@onepiece.local',
    );

    expect(root.textContent).toContain('reviewer-b@onepiece.local');
    const actionLabels = ['Claim', 'Release', 'Approve', 'Reject'];
    const visibleActions = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(
      (button) => actionLabels.includes(button.textContent?.trim() ?? ''),
    );
    expect(visibleActions).toHaveLength(0);
  });

  it('the current claimant can approve it', async () => {
    const fixture = TestBed.createComponent(ReviewQueue);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectItem(
      fixture,
      'reviewer-a@onepiece.local',
      'reviewer-a@onepiece.local',
    );

    const approveButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Approve',
    );
    approveButton!.click();
    fixture.detectChanges();

    const approveReq = httpTesting.expectOne('/api/content/devil-fruit-types/q1/approve');
    expect(approveReq.request.method).toBe('POST');
    approveReq.flush({ ...detailFor(null), status: 'REVIEWED' });
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/review-queue').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(expect.objectContaining({ tone: 'success' }));
  });

  it('the current claimant can reject it with a reason', async () => {
    const fixture = TestBed.createComponent(ReviewQueue);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectItem(
      fixture,
      'reviewer-a@onepiece.local',
      'reviewer-a@onepiece.local',
    );

    const rejectButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Reject',
    );
    rejectButton!.click();
    fixture.detectChanges();

    const textarea = root.querySelector<HTMLTextAreaElement>('#reject-reason');
    textarea!.value = 'Romaji is misspelled';
    textarea!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Confirm Rejection',
    );
    confirmButton!.click();
    fixture.detectChanges();

    const rejectReq = httpTesting.expectOne('/api/content/devil-fruit-types/q1/reject');
    expect(rejectReq.request.method).toBe('POST');
    expect(rejectReq.request.body).toEqual({ reason: 'Romaji is misspelled' });
    rejectReq.flush({
      ...detailFor(null),
      status: 'DRAFT',
      rejectionReason: 'Romaji is misspelled',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/review-queue').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(expect.objectContaining({ tone: 'info' }));
  });
});
