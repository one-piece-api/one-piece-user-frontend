import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { CHARACTER } from '../characters/character.model';
import { ENTITY } from './entities';
import type { ReaderPosition } from './entity-preview';
import { ReaderPreview } from './reader-preview';

const VERSION_URL = '/api/content/characters/c1/versions/2';
const AT_400 = `${VERSION_URL}/preview?asOfChapter=400`;
const LANGUAGES = [{ code: 'en', name: 'English' }];
const BODY = { romaji: 'Portgas D. Ace', translations: { en: { name: 'Ace' } } };

function previewOf(overrides: object = {}) {
  return {
    asOf: { axis: 'CHAPTER', number: 400 },
    visible: true,
    body: BODY,
    mainPortrait: null,
    hiddenEntries: [],
    ...overrides,
  };
}

describe('the preview of a version at a reader position', () => {
  let fixture: ComponentFixture<ReaderPreview>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;
  let chosen: ReaderPosition[];

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
    fixture = TestBed.createComponent(ReaderPreview);
    fixture.componentRef.setInput('versionUrl', VERSION_URL);
    fixture.componentRef.setInput('languages', LANGUAGES);
    chosen = [];
    fixture.componentInstance.chosen.subscribe((position) => chosen.push(position));
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
    root = fixture.nativeElement as HTMLElement;
  }

  async function showAt(position: ReaderPosition, answer: object): Promise<void> {
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    httpTesting.match('/api/me').forEach((request) => request.flush({ username: 'nami' }));
    httpTesting.expectOne(AT_400).flush(answer);
    await settle();
  }

  function type(value: string): HTMLInputElement {
    const input = root.querySelector<HTMLInputElement>('[data-testid="preview-number"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return input;
  }

  it('asks nothing until a position is chosen', async () => {
    fixture.detectChanges();
    await settle();

    expect(root.querySelector('[data-testid="preview-idle"]')).not.toBeNull();
    httpTesting.verify();
  });

  it('draws the resolved body with the same card as the overview', async () => {
    await showAt({ axis: 'chapter', number: 400 }, previewOf());

    expect(root.querySelector('app-entity-card')?.textContent).toContain('Ace');
    expect(root.querySelector('[data-testid="preview-hidden-entries"]')).toBeNull();
  });

  it('says the reader has not met the content yet, without a card', async () => {
    await showAt({ axis: 'chapter', number: 400 }, previewOf({ visible: false, body: null }));

    expect(root.querySelector('[data-testid="preview-not-visible"]')).not.toBeNull();
    expect(root.querySelector('app-entity-card')).toBeNull();
  });

  it('lists the entries hidden for a reason, with where they become visible', async () => {
    await showAt(
      { axis: 'chapter', number: 400 },
      previewOf({
        hiddenEntries: [{ path: 'relatives[0]', reason: 'TARGET_NOT_VISIBLE', visibleFrom: 583 }],
      }),
    );

    const text = root.querySelector('[data-testid="preview-hidden-entries"]')?.textContent ?? '';
    expect(text).toContain('relatives[0]');
    expect(text).toContain('visible from chapter 583');
  });

  it('says so when the backend cannot answer', async () => {
    fixture.componentRef.setInput('position', { axis: 'chapter', number: 400 });
    fixture.detectChanges();
    httpTesting.match('/api/me').forEach((request) => request.flush({ username: 'nami' }));
    httpTesting.expectOne(AT_400).flush({}, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('[data-testid="preview-error"]')).not.toBeNull();
  });

  it('chooses the position typed on Enter, on the axis picked', async () => {
    fixture.detectChanges();
    await settle();

    root.querySelector<HTMLButtonElement>('[data-testid="preview-axis-episode"]')!.click();
    expect(chosen).toEqual([]);

    const input = type('12');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(chosen).toEqual([{ axis: 'episode', number: 12 }]);
  });

  it('refuses a number that is not whole, and chooses nothing', async () => {
    fixture.detectChanges();
    await settle();

    const input = type('1.5');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="preview-number-refused"]')).not.toBeNull();
    expect(chosen).toEqual([]);
  });
});
