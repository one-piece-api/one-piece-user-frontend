import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MascotService } from '../shared/mascot/mascot';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { MyDrafts } from './my-drafts';

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

describe('MyDrafts', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyDrafts, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the caller-owned drafts', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([
      {
        id: 'f1',
        itemId: 'i1',
        entityType: 'DEVIL_FRUIT_TYPE',
        romaji: 'Paramishia',
        displayName: 'Paramecia',
        status: 'DRAFT',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Paramecia');
    expect(root.textContent).toContain('Paramishia');
  });

  it('shows an empty state when there are no drafts', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No draft open yet');
  });

  it('selecting a draft fetches and shows its detail', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([
      {
        id: 'f1',
        itemId: 'i1',
        entityType: 'DEVIL_FRUIT_TYPE',
        romaji: 'Paramishia',
        displayName: 'Paramecia',
        status: 'DRAFT',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const rowButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    );
    const draftRow = rowButtons.find((button) => button.textContent?.includes('Paramecia'));
    draftRow?.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'DRAFT',
      translations: {
        it: { name: 'Paramecia', description: 'Descrizione IT' },
        en: { name: 'Paramecia', description: 'EN description' },
      },
      updatedAt: '2026-09-01T10:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Descrizione IT');
  });

  it('creating a draft posts and opens it in edit mode', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const createPromise = component['createDraft']();
    fixture.detectChanges();

    const createReq = httpTesting.expectOne('/api/content/devil-fruit-types');
    expect(createReq.request.method).toBe('POST');
    const createdDraft = {
      id: 'f2',
      itemId: 'i2',
      romaji: null,
      status: 'DRAFT',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
    };
    createReq.flush(createdDraft);
    await createPromise;
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    httpTesting.expectOne('/api/content/devil-fruit-types/f2').flush(createdDraft);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['selectedId']()).toBe('f2');
    expect(component['editing']()).toBe(true);
  });

  async function selectDraft(
    fixture: ReturnType<typeof TestBed.createComponent<MyDrafts>>,
    status: 'DRAFT' | 'IN_REVIEW',
  ): Promise<HTMLElement> {
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([
      {
        id: 'f1',
        itemId: 'i1',
        entityType: 'DEVIL_FRUIT_TYPE',
        romaji: 'Paramishia',
        displayName: 'Paramecia',
        status,
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const draftRow = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Paramecia'),
    );
    draftRow?.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status,
      translations: {
        it: { name: 'Paramecia', description: 'Descrizione IT' },
        en: { name: 'Paramecia', description: 'EN description' },
      },
      updatedAt: '2026-09-01T10:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return root;
  }

  it('submitting a complete draft moves it to review', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectDraft(fixture, 'DRAFT');

    const submitButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Submit for Review',
    );
    submitButton!.click();
    fixture.detectChanges();

    const submitReq = httpTesting.expectOne('/api/content/devil-fruit-types/f1/submit');
    expect(submitReq.request.method).toBe('POST');
    submitReq.flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'IN_REVIEW',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'IN_REVIEW',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
    });
    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(expect.objectContaining({ tone: 'success' }));
    expect(root.textContent).toContain('In Review');
  });

  it('shows the missing fields when submitting an incomplete draft fails', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectDraft(fixture, 'DRAFT');

    const submitButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Submit for Review',
    );
    submitButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/devil-fruit-types/f1/submit').flush(
      {
        errorCode: 'CONTENT_INCOMPLETE',
        status: 422,
        errors: [{ field: 'translations.en.name', message: 'required' }],
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Arrr! Not ready for review yet. Missing: EN · Name.',
        tone: 'error',
      }),
    );
  });

  it('withdrawing an in-review draft returns it to draft', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectDraft(fixture, 'IN_REVIEW');

    const withdrawButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Withdraw to Draft',
    );
    withdrawButton!.click();
    fixture.detectChanges();

    const withdrawReq = httpTesting.expectOne('/api/content/devil-fruit-types/f1/withdraw');
    expect(withdrawReq.request.method).toBe('POST');
    withdrawReq.flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'DRAFT',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'DRAFT',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
    });
    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: 'Draft brought back. You can edit it again.', tone: 'info' }),
    );
    expect(root.textContent).toContain('Draft');
  });

  it('hides Edit while a draft is in review, and shows who claimed it', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([
      {
        id: 'f1',
        itemId: 'i1',
        entityType: 'DEVIL_FRUIT_TYPE',
        romaji: 'Paramishia',
        displayName: 'Paramecia',
        status: 'IN_REVIEW',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const draftRow = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Paramecia'),
    );
    draftRow?.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'IN_REVIEW',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
      claimedByEmail: 'reviewer@onepiece.local',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const buttonLabels = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(buttonLabels).not.toContain('Edit');
    expect(buttonLabels).not.toContain('Withdraw to Draft');
    expect(root.textContent).toContain('Being reviewed by reviewer@onepiece.local');
  });

  it('shows a specific message when withdrawing a claimed draft is rejected', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectDraft(fixture, 'IN_REVIEW');

    const withdrawButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Withdraw to Draft',
    );
    withdrawButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/content/devil-fruit-types/f1/withdraw')
      .flush(
        { errorCode: 'CONTENT_REVIEW_ALREADY_CLAIMED', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'IN_REVIEW',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
      claimedByEmail: 'reviewer@onepiece.local',
    });
    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: "Arrr! A reviewer is already looking at it — you can't withdraw it now.",
        tone: 'error',
      }),
    );
  });

  it('pre-selects and opens the draft named by the ?open= query param', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MyDrafts, provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ open: 'f1' }) } },
        },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([
      {
        id: 'f1',
        itemId: 'i1',
        entityType: 'DEVIL_FRUIT_TYPE',
        romaji: 'Paramishia',
        displayName: 'Paramecia',
        status: 'DRAFT',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ]);
    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'DRAFT',
      translations: {
        it: { name: 'Paramecia', description: 'Descrizione IT' },
        en: { name: 'Paramecia', description: 'EN description' },
      },
      updatedAt: '2026-09-01T10:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedId']()).toBe('f1');
    expect(fixture.nativeElement.textContent).toContain('Descrizione IT');
  });

  it('shows a rejected draft distinctly in the list', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([
      {
        id: 'f1',
        itemId: 'i1',
        entityType: 'DEVIL_FRUIT_TYPE',
        romaji: 'Paramishia',
        displayName: 'Paramecia',
        status: 'DRAFT',
        updatedAt: '2026-09-01T10:00:00Z',
        rejectionReason: 'Romaji is misspelled',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Rejected');
  });

  it('hides Delete Draft once the item has been published', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    httpTesting.expectOne('/api/content/my-drafts').flush([
      {
        id: 'f1',
        itemId: 'i1',
        entityType: 'DEVIL_FRUIT_TYPE',
        romaji: 'Paramishia',
        displayName: 'Paramecia',
        status: 'DRAFT',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const draftRow = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Paramecia'),
    );
    draftRow?.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'DRAFT',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
      everPublished: true,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const buttonLabels = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(buttonLabels).not.toContain('Delete Draft');
  });

  it('deletes a never-published draft and returns to the list', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectDraft(fixture, 'DRAFT');

    const deleteButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Delete Draft',
    );
    deleteButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Confirm deletion',
    );
    confirmButton!.click();
    fixture.detectChanges();

    const deleteReq = httpTesting.expectOne('/api/content/devil-fruit-types/f1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: 'Draft deleted for good.', tone: 'success' }),
    );
    expect(root.textContent).toContain('No draft open yet');
  });

  it('shows a blocked message when deleting a since-published item is refused', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectDraft(fixture, 'DRAFT');

    const deleteButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Delete Draft',
    );
    deleteButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Confirm deletion',
    );
    confirmButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/content/devil-fruit-types/f1')
      .flush(
        { errorCode: 'CONTENT_CANNOT_DELETE_PUBLISHED_ITEM', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/devil-fruit-types/f1').flush({
      id: 'f1',
      itemId: 'i1',
      romaji: 'Paramishia',
      status: 'DRAFT',
      translations: {},
      updatedAt: '2026-09-01T10:00:00Z',
      everPublished: true,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Arrr! This item has already been published once — it can no longer be deleted, only retired from the Encyclopedia.',
        tone: 'error',
      }),
    );
  });
});
