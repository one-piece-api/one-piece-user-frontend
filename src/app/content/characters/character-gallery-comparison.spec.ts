import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import type { VersionStatus } from '../content.model';
import { ENTITY } from '../entity/entities';
import { EntityComparison } from '../entity/entity-comparison';
import { CHARACTER } from './character.model';

const VERSIONS = '/api/content/characters/c1/versions';
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

/** A version whose gallery is one appearance with this image, captioned `caption`. */
function version(number: number, image: object, caption = 'Luffy') {
  return {
    ...summary(number, number === 1 ? 'PUBLISHED' : 'DRAFT'),
    blockedActions: [],
    rejectionReason: null,
    body: {
      romaji: 'Monkey D. Luffy',
      gallery: [
        { image, kind: 'ASPETTO', caption: { en: caption }, discovered: null, ended: null },
      ],
      translations: { en: { name: 'Luffy' } },
    },
  };
}

polyfillDialog();

describe('the comparison of two versions of a character gallery', () => {
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
        { provide: ENTITY, useValue: CHARACTER },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  /** Opens v2 against v1, each with the image and caption given. */
  async function compare(before: object, after: object, caption = 'Luffy'): Promise<void> {
    fixture = TestBed.createComponent(EntityComparison);
    fixture.componentRef.setInput('versionsUrl', VERSIONS);
    fixture.componentRef.setInput('versions', [summary(1, 'PUBLISHED'), summary(2, 'DRAFT')]);
    fixture.componentRef.setInput('onlineVersionNumber', 1);
    fixture.componentRef.setInput('languages', [{ code: 'en', name: 'English' }]);
    fixture.componentRef.setInput('target', 2);
    fixture.detectChanges();
    httpTesting.match('/api/me').forEach((request) => request.flush({ username: 'nami' }));
    httpTesting.expectOne(`${VERSIONS}/2`).flush(version(2, after, caption));
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
      .find((label) => label?.startsWith('Image 1~') || label?.startsWith('Image 1+'));
  }

  it('shows the old and the new image of an entry side by side, as thumbnails', async () => {
    await compare(RED, BLUE);

    expect(imageRow()).toBe('Image 1~ modified');
    expect(sides()).toEqual([RED.url, BLUE.url]);
  });

  it('keeps an image that did not change among the unchanged, while its caption changed', async () => {
    await compare(RED, RED, 'Straw Hat');

    expect(imageRow()).toBeUndefined();
    expect(root.querySelector('[data-testid="comparison-images"]')).toBeNull();
    const labels = Array.from(root.querySelectorAll('[data-testid="comparison-row"]')).map((row) =>
      row.firstElementChild?.textContent?.replace(/s+/g, ' ').trim(),
    );
    expect(labels).toContain('Image 1 · caption · EN~ modified');
  });
});
