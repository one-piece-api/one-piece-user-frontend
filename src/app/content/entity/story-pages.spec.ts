import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MascotService } from '../../shared/mascot/mascot';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { pixels, pngFile } from '../../testing/png-file';
import { webpFile } from '../../testing/webp-file';
import { CHAPTER } from '../chapters/chapter.model';
import type { VersionStatus } from '../content.model';
import { EPISODE } from '../episodes/episode.model';
import { VOLUME } from '../volumes/volume.model';
import { ENTITY } from './entities';
import { diffBodies, type EntityBody } from './entity-body';
import { EntityCard } from './entity-card';
import { EntityComparison } from './entity-comparison';
import type { EntityDefinition } from './entity-definition';
import { EntityEditor } from './entity-editor';
import { EntityImageFrame } from './entity-image-frame';

const ID = '3f2a9c1b-0000-4000-8000-000000000003';
const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const LANGUAGES = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
];

/** Stands in for the browser's decoding, which the test DOM lacks: every image decodes to `decoded`. */
function stubImageDecoding(decoded: Uint8ClampedArray): void {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close: () => undefined }));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return { drawImage: () => undefined, getImageData: () => ({ data: decoded }) };
      }
    },
  );
}

/** Where an editor leads once it is done: not under test here. */
@Component({ template: '' })
class Elsewhere {}

describe('the editor of the story entities', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  async function configure(entity: EntityDefinition): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: entity },
        provideRouter(
          [
            { path: `${entity.route.slice(1)}/new`, component: EntityEditor },
            { path: `${entity.route.slice(1)}/:id/edit`, component: EntityEditor },
            { path: `${entity.route.slice(1)}/:id`, component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpTesting.verify();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush(LANGUAGES);
    root = harness.routeNativeElement as HTMLElement;
    await settle();
  }

  /** Opens the draft v1 of a content already saved, with the body given. */
  async function openDraft(entity: EntityDefinition, body: object): Promise<void> {
    harness = await RouterTestingHarness.create(`${entity.route}/${ID}/edit`);
    harness.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush(LANGUAGES);
    root = harness.routeNativeElement as HTMLElement;
    await settle();
    const draft = {
      number: 1,
      status: 'DRAFT',
      author: NAMI,
      basedOn: null,
      claimant: null,
      everPublished: false,
      allowedActions: ['EDIT', 'DELETE', 'SUBMIT'],
      overrideActions: [],
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z',
    };
    httpTesting
      .expectOne(`${entity.api}/${ID}`)
      .flush({ id: ID, onlineVersionNumber: null, versions: [draft] });
    await settle();
    httpTesting
      .expectOne(`${entity.api}/${ID}/versions/1`)
      .flush({ ...draft, blockedActions: [], rejectionReason: null, body });
    await settle();
  }

  function field(key: string) {
    return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#draft-${key}`)!;
  }

  async function type(key: string, text: string): Promise<void> {
    field(key).value = text;
    field(key).dispatchEvent(new Event('input'));
    await settle();
  }

  async function save(): Promise<void> {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  /** Each line of the checklist, its texts joined by one space: mark, label, note. */
  function checks(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="ready-check"]')).map((check) => {
      const texts: string[] = [];
      const walker = document.createTreeWalker(check, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        texts.push(walker.currentNode.textContent?.trim() ?? '');
      }
      return texts.filter(Boolean).join(' ');
    });
  }

  function errors(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="field-error"]')).map(
      (error) => error.textContent?.trim() ?? '',
    );
  }

  describe('of a chapter', () => {
    beforeEach(async () => {
      await configure(CHAPTER);
      await open('/content/chapters/new');
    });

    it('holds the number as a numeric input and the extras as optional ones', () => {
      expect(field('number').type).toBe('number');
      expect(field('number').getAttribute('inputmode')).toBe('numeric');
      expect((field('number') as HTMLInputElement).min).toBe('0');
      expect((field('pageCount') as HTMLInputElement).min).toBe('1');
      expect(field('japaneseTitle').getAttribute('lang')).toBe('ja');
      expect(field('japaneseTitle').maxLength).toBe(200);
      expect(root.querySelector('h1')?.textContent?.trim()).toBe('New chapter');
    });

    it('asks review for the number and the arc only, then the texts of each language', () => {
      expect(checks().slice(0, 4)).toEqual([
        '! Number · unique required',
        '! Arc required',
        '! Title · Italiano required',
        '! Description · Italiano required',
      ]);
      expect(checks().join()).not.toMatch(/Japanese|Pages|Volume|Releases/);
    });

    it('names the draft after its number until it has a title', async () => {
      await type('number', '12');
      expect(root.querySelector('h1')?.textContent?.trim()).toBe('Chapter 12');

      await type('title', 'Romance Dawn');
      expect(root.querySelector('h1')?.textContent?.trim()).toBe('Romance Dawn');
    });

    it('saves the number as a number, the optional ones empty and no releases as a list', async () => {
      await type('number', '12');
      await type('title', 'Romance Dawn');
      await type('japaneseTitle', ' ロマンス ');
      await type('pageCount', '19');

      await save();
      const request = httpTesting.expectOne('/api/content/chapters');
      expect(request.request.body).toEqual({
        number: 12,
        arc: null,
        volume: null,
        japaneseTitle: 'ロマンス',
        pageCount: 19,
        releases: [],
        translations: {
          it: { title: null, description: null },
          en: { title: 'Romance Dawn', description: null },
        },
      });
      request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
      await settle();
    });

    it('sends a number that is not one as nothing, for the backend to refuse', async () => {
      await type('number', '-3');

      await save();
      const request = httpTesting.expectOne('/api/content/chapters');
      expect((request.request.body as { number: unknown }).number).toBeNull();
      request.flush(
        {
          errorCode: 'CONTENT_VALUE_INVALID',
          errors: [{ field: 'number', message: 'must be 0 or more' }],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await settle();

      expect(errors()).toEqual(['must be a whole number, not below the minimum']);
      expect(field('number').getAttribute('aria-invalid')).toBe('true');
      expect(TestBed.inject(MascotService).message().text).toContain('number is off course');
    });

    it('says a taken number is a number, not a romaji', async () => {
      await type('number', '1');

      await save();
      httpTesting.expectOne('/api/content/chapters').flush(
        {
          errorCode: 'CONTENT_VALUE_ALREADY_USED',
          errors: [{ field: 'number', message: 'is taken' }],
        },
        { status: 409, statusText: 'Conflict' },
      );
      await settle();

      expect(errors()).toEqual(['already used by another content']);
      expect(TestBed.inject(MascotService).message().text).toContain('same number');
    });

    describe('its releases', () => {
      function rows(): HTMLElement[] {
        return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="release-row"]'));
      }

      async function addRow(): Promise<void> {
        root.querySelector<HTMLButtonElement>('[data-testid="release-add"]')!.click();
        await settle();
      }

      async function fill(index: number, country: string, date: string): Promise<void> {
        const select = root.querySelector<HTMLSelectElement>(`#draft-releases-${index}-country`)!;
        select.value = country;
        select.dispatchEvent(new Event('change'));
        const day = root.querySelector<HTMLInputElement>(`#draft-releases-${index}-date`)!;
        day.value = date;
        day.dispatchEvent(new Event('input'));
        await settle();
      }

      function country(index: number): HTMLSelectElement {
        return root.querySelector<HTMLSelectElement>(`#draft-releases-${index}-country`)!;
      }

      it('starts with none, and a row per country is added with a leading empty choice', async () => {
        expect(rows()).toHaveLength(0);
        expect(root.textContent).toContain('No dates.');

        await addRow();

        expect(rows()).toHaveLength(1);
        expect(country(0).options[0].value).toBe('');
        expect(country(0).options).toHaveLength(250);
        expect(country(0).selectedOptions[0].value).toBe('');
      });

      it('names the countries in the language of the interface, in order', async () => {
        await addRow();

        const names = Array.from(country(0).options)
          .slice(1)
          .map((option) => option.textContent?.trim() ?? '');
        expect(names).toContain('Japan');
        expect(names).toEqual([...names].sort(new Intl.Collator('en').compare));
        expect(country(0).querySelector<HTMLOptionElement>('option[value="JP"]')?.text.trim()).toBe(
          'Japan',
        );
      });

      it('disables a country that another row already has, never its own', async () => {
        await addRow();
        await fill(0, 'JP', '1997-10-20');
        await addRow();

        const taken = (row: number) =>
          country(row).querySelector<HTMLOptionElement>('option[value="JP"]')!.disabled;
        expect(taken(1)).toBe(true);
        expect(taken(0)).toBe(false);
        expect(country(1).querySelector<HTMLOptionElement>('option[value="IT"]')!.disabled).toBe(
          false,
        );
      });

      it('sends the complete rows by date, and leaves out the one still empty', async () => {
        await addRow();
        await fill(0, 'IT', '2000-06-01');
        await addRow();
        await fill(1, 'JP', '1997-10-20');
        await addRow();
        await fill(2, 'FR', '');

        await save();
        const request = httpTesting.expectOne('/api/content/chapters');
        expect((request.request.body as { releases: unknown }).releases).toEqual([
          { country: 'JP', date: '1997-10-20' },
          { country: 'IT', date: '2000-06-01' },
        ]);
        request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
        await settle();
      });

      it('removes a row', async () => {
        await addRow();
        await fill(0, 'JP', '1997-10-20');
        await addRow();
        await fill(1, 'IT', '2000-06-01');

        root.querySelector<HTMLButtonElement>('[data-testid="release-remove"]')!.click();
        await settle();

        expect(rows()).toHaveLength(1);
        expect(country(0).value).toBe('IT');
        expect(root.querySelector<HTMLInputElement>('#draft-releases-0-date')!.value).toBe(
          '2000-06-01',
        );
      });

      it('marks the row the backend refused, by its place in the JSON sent', async () => {
        await addRow();
        await fill(0, 'IT', '2000-06-01');
        await addRow();
        await fill(1, 'JP', '1997-10-20');

        await save();
        // Sent in date order: releases[0] is the Japanese row, the second one drawn.
        httpTesting.expectOne('/api/content/chapters').flush(
          {
            errorCode: 'CONTENT_VALUE_INVALID',
            errors: [{ field: 'releases[0].country', message: 'repeated' }],
          },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
        await settle();

        expect(errors()).toEqual(['pick a valid country, with one date per country']);
        expect(country(1).getAttribute('aria-invalid')).toBe('true');
        expect(country(0).getAttribute('aria-invalid')).toBeNull();
        expect(TestBed.inject(MascotService).message().text).toContain('Some date is off course');
      });

      it('marks a day the backend refused', async () => {
        await addRow();
        await fill(0, 'JP', '1997-10-20');

        await save();
        httpTesting.expectOne('/api/content/chapters').flush(
          {
            errorCode: 'VALIDATION_FAILED',
            errors: [{ field: 'releases[0].date', message: 'must not be null' }],
          },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
        await settle();

        expect(errors()).toEqual(['pick a valid date']);
        expect(root.querySelector('#draft-releases-0-date')!.getAttribute('aria-invalid')).toBe(
          'true',
        );
      });
    });
  });

  describe('of an episode', () => {
    beforeEach(async () => {
      await configure(EPISODE);
      await open('/content/episodes/new');
    });

    it('keeps its arc optional and lists broadcasts, not releases', async () => {
      expect(checks().join()).not.toContain('Arc');
      expect(root.querySelector('[data-testid="draft-broadcasts"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="draft-releases"]')).toBeNull();

      root.querySelector<HTMLButtonElement>('[data-testid="release-add"]')!.click();
      await settle();
      const select = root.querySelector<HTMLSelectElement>('#draft-broadcasts-0-country')!;
      select.value = 'JP';
      select.dispatchEvent(new Event('change'));
      await type('number', '1');
      const day = root.querySelector<HTMLInputElement>('#draft-broadcasts-0-date')!;
      day.value = '1999-10-20';
      day.dispatchEvent(new Event('input'));
      await settle();

      await save();
      const request = httpTesting.expectOne('/api/content/episodes');
      expect(request.request.body).toMatchObject({
        number: 1,
        arc: null,
        broadcasts: [{ country: 'JP', date: '1999-10-20' }],
      });
      request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
      await settle();
    });
  });

  describe('of a volume', () => {
    const COVER = { id: 'c0ffee', url: '/api/content/images/c0ffee' };

    beforeEach(async () => {
      await configure(VOLUME);
      stubImageDecoding(pixels(10, 0));
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cover');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    async function pick(file: File): Promise<void> {
      const input = field('cover') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle();
    }

    function imageError(): string | undefined {
      return root.querySelector('[data-testid="image-error"]')?.textContent?.trim();
    }

    it('draws the cover at the ratio of its profile and says what it must be', async () => {
      await open('/content/volumes/new');

      expect(
        root
          .querySelector<HTMLElement>('[data-testid="image-drop"]')!
          .style.getPropertyValue('--ratio'),
      ).toBe('0.631578947368421');
      expect(root.textContent).toContain('PNG or WebP, 12:19, at least 504 × 800 px.');
      expect(root.textContent).not.toContain('transparent background');
      expect(checks().join()).not.toMatch(/over/);
    });

    it('refuses a cover of the fruit ratio, and one under the minimum, with the profile numbers', async () => {
      await open('/content/volumes/new');

      await pick(pngFile(640, 800));
      expect(imageError()).toBe('The image is 640 × 800: it must be 12:19 (within 10%).');

      await pick(pngFile(420, 665));
      expect(imageError()).toBe('The image is 420 × 665: it must be at least 504 × 800.');

      await pick(webpFile(783, 1232, 'extended', 'Volume_1.webp'));
      expect(imageError()).toBeUndefined();
    });

    it('sends a cover that passes beside the JSON, in the part named cover', async () => {
      await open('/content/volumes/new');
      await type('number', '1');
      await pick(pngFile(504, 800));
      expect(root.querySelector('[data-testid="image-preview"]')?.getAttribute('src')).toBe(
        'blob:cover',
      );

      await save();
      const request = httpTesting.expectOne('/api/content/volumes');
      const form = request.request.body as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(form.get('cover')).toBeInstanceOf(File);
      expect(form.get('image')).toBeNull();
      const version = JSON.parse(await (form.get('version') as Blob).text());
      expect(version).toMatchObject({ number: 1, releases: [], japaneseTitle: null });
      request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
      await settle();
    });

    it('keeps the saved cover on a save, and asks the backend to drop it once removed', async () => {
      await openDraft(VOLUME, { number: 3, cover: COVER, releases: [], translations: {} });
      expect(root.querySelector('[data-testid="image-preview"]')?.getAttribute('src')).toBe(
        COVER.url,
      );

      await save();
      const kept = httpTesting.expectOne(`/api/content/volumes/${ID}/versions/1`);
      expect(kept.request.body).not.toHaveProperty('removeImage');
      expect(kept.request.body).toMatchObject({ number: 3 });
      kept.flush({ number: 1 });
      await settle();
    });

    it('asks the backend to drop the cover once it is removed', async () => {
      await openDraft(VOLUME, { number: 3, cover: COVER, releases: [], translations: {} });

      root.querySelector<HTMLButtonElement>('[data-testid="image-remove"]')!.click();
      await settle();
      await save();

      const request = httpTesting.expectOne(`/api/content/volumes/${ID}/versions/1`);
      expect(request.request.body).toMatchObject({ number: 3, removeImage: true });
      request.flush({ number: 1 });
      await settle();
    });

    it('loads the releases of a saved version into rows', async () => {
      await openDraft(VOLUME, {
        number: 3,
        releases: [{ country: 'JP', date: '1997-12-24' }],
        translations: {},
      });

      expect(root.querySelectorAll('[data-testid="release-row"]')).toHaveLength(1);
      expect(field('releases-0-country').value).toBe('JP');
      expect(field('releases-0-date').value).toBe('1997-12-24');
    });
  });
});

describe('the image frame', () => {
  function frame(ratio?: number): HTMLElement {
    const fixture: ComponentFixture<EntityImageFrame> = TestBed.createComponent(EntityImageFrame);
    if (ratio !== undefined) {
      fixture.componentRef.setInput('ratio', ratio);
    }
    fixture.detectChanges();
    return fixture.nativeElement.firstElementChild as HTMLElement;
  }

  it('is 4:5 unless told otherwise, so the Devil Fruit keeps its frame', () => {
    expect(frame().style.getPropertyValue('--ratio')).toBe('0.8');
  });

  it('takes the ratio of the image profile', () => {
    expect(frame(420 / 600).style.getPropertyValue('--ratio')).toBe('0.7');
  });
});

describe('the card of a story content', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  function render(entity: EntityDefinition, body: EntityBody): void {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: entity }],
    });
    fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('languages', LANGUAGES);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function text(testId: string): string | undefined {
    return root
      .querySelector(`[data-testid="${testId}"]`)
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
  }

  const ARC = { id: 'a1', number: 1, names: { en: 'Romance Dawn', it: 'Alba' } };

  const CHAPTER_BODY: EntityBody = {
    number: 1,
    arc: ARC,
    volume: null,
    japaneseTitle: 'ロマンス・ドーン',
    pageCount: 53,
    releases: [
      { country: 'IT', date: '2000-06-01' },
      { country: 'JP', date: '1997-07-22' },
    ],
    translations: { en: { title: 'Romance Dawn', description: 'The start.' }, it: {} },
  };

  it('names the content by its title and gives its number as the natural key', () => {
    render(CHAPTER, CHAPTER_BODY);

    expect(text('card-name')).toBe('Romance Dawn');
    expect(root.textContent).toContain('Chapter 1');
  });

  it('says the language has no title, not no name', () => {
    render(CHAPTER, CHAPTER_BODY);
    root.querySelector<HTMLButtonElement>('[role="tab"]')!.click();
    fixture.detectChanges();

    expect(text('card-name')).toBe('— no title in this language —');
  });

  it('links the arc as it is today, numbered, and says when there is no volume', () => {
    render(CHAPTER, CHAPTER_BODY);

    expect(text('card-arc')).toBe('1 · Romance Dawn');
    expect(root.querySelector('[data-testid="card-arc"]')?.getAttribute('href')).toBe(
      '/content/arcs/a1',
    );
    expect(text('card-volume')).toBe('not collected in a volume');
  });

  it('shows the Japanese title, the pages and the releases by day with the country named', () => {
    render(CHAPTER, CHAPTER_BODY);

    expect(text('card-japaneseTitle')).toBe('ロマンス・ドーン');
    expect(root.querySelector('[data-testid="card-japaneseTitle"]')?.getAttribute('lang')).toBe(
      'ja',
    );
    expect(text('card-pageCount')).toBe('53');
    const releases = Array.from(root.querySelectorAll('[data-testid="card-releases"] li')).map(
      (entry) => entry.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(releases).toEqual(['Japan · July 22, 1997', 'Italy · June 1, 2000']);
  });

  it('leaves out the optional things the version does not have', () => {
    render(CHAPTER, { number: 2, arc: null, translations: {} });

    expect(root.querySelector('[data-testid="card-japaneseTitle"]')).toBeNull();
    expect(root.querySelector('[data-testid="card-pageCount"]')).toBeNull();
    expect(root.querySelector('[data-testid="card-releases"]')).toBeNull();
    expect(text('card-arc')).toBe('not linked');
  });

  it('draws a volume cover at its own ratio, with the placeholder naming the volume', () => {
    render(VOLUME, { number: 7, cover: null, releases: [], translations: {} });

    const frameElement = root.querySelector<HTMLElement>('app-entity-image-frame > div')!;
    expect(frameElement.style.getPropertyValue('--ratio')).toBe('0.631578947368421');
    expect(text('entity-image-placeholder')).toBe('Image of Volume 7');
  });

  it('shows the broadcasts of an episode', () => {
    render(EPISODE, {
      number: 1,
      arc: null,
      broadcasts: [{ country: 'JP', date: '1999-10-20' }],
      translations: {},
    });

    expect(root.querySelector('[data-testid="card-broadcasts"]')).not.toBeNull();
    expect(text('card-arc')).toBe('not linked');
  });
});

describe('the comparison of story contents', () => {
  it('shows the new kinds as modified, added and removed', () => {
    const before: EntityBody = {
      number: 1,
      arc: { id: 'a1', number: 1, names: { en: 'Romance Dawn' } },
      volume: { id: 'v1', number: 1, names: {} },
      japaneseTitle: 'A',
      pageCount: 19,
      releases: [{ country: 'JP', date: '1997-07-22' }],
      translations: { en: { title: 'Dawn' } },
    };
    const after: EntityBody = {
      number: 2,
      arc: { id: 'a1', number: 1, names: { en: 'Romance Dawn (renamed)' } },
      volume: null,
      japaneseTitle: 'A',
      pageCount: 20,
      releases: [
        { country: 'JP', date: '1997-07-22' },
        { country: 'IT', date: '2000-06-01' },
      ],
      translations: { en: { title: 'Dawn' } },
    };

    const changes = Object.fromEntries(
      diffBodies(CHAPTER, before, after, ['en']).map((diff) => [
        diff.field.field,
        [diff.change, diff.before, diff.after],
      ]),
    );

    expect(changes).toEqual({
      number: ['MODIFIED', '1', '2'],
      arc: ['UNCHANGED', '1 · Romance Dawn', '1 · Romance Dawn (renamed)'],
      volume: ['REMOVED', '1', null],
      japaneseTitle: ['UNCHANGED', 'A', 'A'],
      pageCount: ['MODIFIED', '19', '20'],
      releases: ['MODIFIED', 'JP 1997-07-22', 'JP 1997-07-22\nIT 2000-06-01'],
      title: ['UNCHANGED', 'Dawn', 'Dawn'],
    });
  });

  it('shows a release list that was never written as added once it is', () => {
    const diffs = diffBodies(
      EPISODE,
      { number: 1, broadcasts: [], translations: {} },
      { number: 1, broadcasts: [{ country: 'JP', date: '1999-10-20' }], translations: {} },
      ['en'],
    );

    expect(diffs.find((diff) => diff.field.field === 'broadcasts')?.change).toBe('ADDED');
  });
});

describe('the comparison of two volumes', () => {
  const VERSIONS = '/api/content/volumes/v1/versions';
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

  function version(number: number, cover: object) {
    return {
      ...summary(number, number === 1 ? 'PUBLISHED' : 'DRAFT'),
      blockedActions: [],
      rejectionReason: null,
      body: { number: 1, cover, releases: [], translations: { en: { title: 'Dawn' } } },
    };
  }

  polyfillDialog();

  it('shows both covers in frames of the cover ratio', async () => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ENTITY, useValue: VOLUME },
      ],
    });
    const httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EntityComparison as Type<EntityComparison>);
    fixture.componentRef.setInput('versionsUrl', VERSIONS);
    fixture.componentRef.setInput('versions', [summary(1, 'PUBLISHED'), summary(2, 'DRAFT')]);
    fixture.componentRef.setInput('onlineVersionNumber', 1);
    fixture.componentRef.setInput('languages', [{ code: 'en', name: 'English' }]);
    fixture.componentRef.setInput('target', 2);
    fixture.detectChanges();
    httpTesting.match('/api/me').forEach((request) => request.flush({ username: 'nami' }));
    httpTesting.expectOne(`${VERSIONS}/2`).flush(version(2, BLUE));
    httpTesting.expectOne(`${VERSIONS}/1`).flush(version(1, RED));
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
    const root = fixture.nativeElement as HTMLElement;

    const frames = Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-testid="comparison-images"] app-entity-image-frame > div',
      ),
    );
    expect(frames.map((element) => element.style.getPropertyValue('--ratio'))).toEqual([
      '0.631578947368421',
      '0.631578947368421',
    ]);
    const label = root.querySelector('[data-testid="comparison-row"]')?.firstElementChild;
    expect(label?.textContent?.replace(/\s+/g, ' ').trim()).toContain('Cover');
    httpTesting.verify();
  });
});
