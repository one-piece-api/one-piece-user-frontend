import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import type { VersionStatus } from '../content.model';
import { ENTITY } from '../entity/entities';
import { EntityComparison } from '../entity/entity-comparison';
import { DEVIL_FRUIT } from './devil-fruit.model';

const VERSIONS = '/api/content/devil-fruits/f1/versions';
const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const RED = { id: 'a1', url: '/api/content/images/a1' };
const BLUE = { id: 'b2', url: '/api/content/images/b2' };

function summary(number: number, status: VersionStatus) {
  return {
    number,
    status,
    author: NAMI,
    basedOn: number === 1 ? null : number - 1,
    claimant: null,
    everPublished: status === 'PUBLISHED',
    allowedActions: [],
    overrideActions: [],
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };
}

function version(number: number, image: object | null) {
  return {
    ...summary(number, number === 1 ? 'PUBLISHED' : 'DRAFT'),
    blockedActions: [],
    rejectionReason: null,
    body: {
      romaji: 'Mera Mera no Mi',
      type: null,
      image,
      translations: { en: { name: 'Flame-Flame', description: 'Fire.' } },
    },
  };
}

polyfillDialog();

describe('the comparison of two versions of a Devil Fruit', () => {
  let fixture: ComponentFixture<EntityComparison>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ENTITY, useValue: DEVIL_FRUIT },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  /** Opens v2 against v1, each with the image given. */
  async function compare(before: object | null, after: object | null): Promise<void> {
    fixture = TestBed.createComponent(EntityComparison);
    fixture.componentRef.setInput('versionsUrl', VERSIONS);
    fixture.componentRef.setInput('versions', [summary(1, 'PUBLISHED'), summary(2, 'DRAFT')]);
    fixture.componentRef.setInput('onlineVersionNumber', 1);
    fixture.componentRef.setInput('languages', [{ code: 'en', name: 'English' }]);
    fixture.componentRef.setInput('target', 2);
    fixture.detectChanges();
    httpTesting.match('/api/me').forEach((request) => request.flush({ username: 'nami' }));
    httpTesting.expectOne(`${VERSIONS}/2`).flush(version(2, after));
    httpTesting.expectOne(`${VERSIONS}/1`).flush(version(1, before));
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
    root = fixture.nativeElement as HTMLElement;
  }

  /** The two sides of the image row: the image's address, or the placeholder's words. */
  function sides(): string[] {
    const row = root.querySelector('[data-testid="comparison-images"]');
    return Array.from(row?.querySelectorAll('app-entity-image-frame') ?? []).map(
      (frame) => frame.querySelector('img')?.getAttribute('src') ?? frame.textContent?.trim() ?? '',
    );
  }

  function imageRow(): string | undefined {
    return Array.from(root.querySelectorAll('[data-testid="comparison-row"]'))
      .map((row) => row.firstElementChild?.textContent?.replace(/\s+/g, ' ').trim())
      .find((label) => label?.startsWith('Image'));
  }

  it('shows both images side by side when the image changed', async () => {
    await compare(RED, BLUE);

    expect(imageRow()).toBe('Image~ modified');
    expect(sides()).toEqual([RED.url, BLUE.url]);
  });

  it('shows the placeholder on the side without one', async () => {
    await compare(null, BLUE);

    expect(imageRow()).toBe('Image+ added');
    expect(sides()).toEqual(['No image', BLUE.url]);
  });

  it('counts the same image among the unchanged fields', async () => {
    await compare(RED, { ...RED });

    expect(imageRow()).toBeUndefined();
  });

  it('leaves the image out when neither version has one', async () => {
    await compare(null, null);

    expect(imageRow()).toBeUndefined();
    expect(root.querySelector('[data-testid="comparison-images"]')).toBeNull();
  });
});
