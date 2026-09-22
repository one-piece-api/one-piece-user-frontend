import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MascotService } from '../shared/mascot/mascot';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { Encyclopedia } from './encyclopedia';

describe('Encyclopedia', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Encyclopedia, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushMe(permissions: string[]): void {
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: ['PUBLISHER'],
      permissions,
    });
  }

  const reviewedItem = {
    itemId: 'i1',
    workingRevisionId: 'wr1',
    entityType: 'DEVIL_FRUIT_TYPE',
    romaji: 'Paramishia',
    displayName: 'Paramecia',
    status: 'REVIEWED',
    updatedAt: '2026-09-22T10:00:00Z',
  };

  const publishedItem = {
    itemId: 'i2',
    workingRevisionId: null as string | null,
    entityType: 'DEVIL_FRUIT_TYPE',
    romaji: 'Zoan',
    displayName: 'Zoan',
    status: 'PUBLISHED',
    updatedAt: '2026-09-22T09:00:00Z',
  };

  function reviewedDetail() {
    return {
      itemId: 'i1',
      workingRevisionId: 'wr1',
      romaji: 'Paramishia',
      status: 'REVIEWED',
      translations: {
        it: { name: 'Paramecia', description: 'Descrizione IT' },
        en: { name: 'Paramecia', description: 'EN description' },
      },
      updatedAt: '2026-09-22T10:00:00Z',
      sequenceNumber: null as number | null,
      publisherEmail: null as string | null,
    };
  }

  function publishedDetail() {
    return {
      itemId: 'i2',
      workingRevisionId: null as string | null,
      romaji: 'Zoan',
      status: 'PUBLISHED',
      translations: {
        it: { name: 'Zoan', description: 'Descrizione IT' },
        en: { name: 'Zoan', description: 'EN description' },
      },
      updatedAt: '2026-09-22T09:00:00Z',
      sequenceNumber: 1,
      publisherEmail: 'nami@onepiece.local',
    };
  }

  it('lists reviewed and published items', async () => {
    const fixture = TestBed.createComponent(Encyclopedia);
    fixture.detectChanges();
    flushMe(['content:read']);
    httpTesting.expectOne('/api/content/encyclopedia').flush([reviewedItem, publishedItem]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Paramecia');
    expect(root.textContent).toContain('Zoan');
  });

  async function selectItem(
    fixture: ReturnType<typeof TestBed.createComponent<Encyclopedia>>,
    permissions: string[],
  ): Promise<HTMLElement> {
    fixture.detectChanges();
    flushMe(permissions);
    httpTesting.expectOne('/api/content/encyclopedia').flush([reviewedItem]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const row = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Paramecia'),
    );
    row?.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/encyclopedia/i1').flush(reviewedDetail());
    await fixture.whenStable();
    fixture.detectChanges();
    return root;
  }

  it('a PUBLISHER sees Publish on a reviewed item and can publish it', async () => {
    const fixture = TestBed.createComponent(Encyclopedia);
    const mascotService = TestBed.inject(MascotService);
    const root = await selectItem(fixture, ['content:read', 'content:publish']);

    const publishButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Publish',
    );
    expect(publishButton).toBeTruthy();
    publishButton!.click();
    fixture.detectChanges();

    const publishReq = httpTesting.expectOne('/api/content/devil-fruit-types/wr1/publish');
    expect(publishReq.request.method).toBe('POST');
    publishReq.flush({});
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/encyclopedia/i1').flush(publishedDetail());
    httpTesting
      .expectOne('/api/content/encyclopedia')
      .flush([{ ...reviewedItem, status: 'PUBLISHED' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(expect.objectContaining({ tone: 'success' }));
  });

  it('a non-PUBLISHER does not see Publish on a reviewed item', async () => {
    const fixture = TestBed.createComponent(Encyclopedia);
    const root = await selectItem(fixture, ['content:read']);

    const publishButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Publish',
    );
    expect(publishButton).toBeUndefined();
  });

  it('shows version info for a published item', async () => {
    const fixture = TestBed.createComponent(Encyclopedia);
    fixture.detectChanges();
    flushMe(['content:read', 'content:publish']);
    httpTesting.expectOne('/api/content/encyclopedia').flush([publishedItem]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const row = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Zoan'),
    );
    row?.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/encyclopedia/i2').flush(publishedDetail());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('v1');
    expect(root.textContent).toContain('nami@onepiece.local');
    const publishButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Publish',
    );
    expect(publishButton).toBeUndefined();
  });
});
