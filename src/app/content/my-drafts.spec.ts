import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { MyDrafts } from './my-drafts';

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

    httpTesting.expectOne('/api/content/my-drafts').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No draft open yet');
  });

  it('selecting a draft fetches and shows its detail', async () => {
    const fixture = TestBed.createComponent(MyDrafts);
    fixture.detectChanges();
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
});
