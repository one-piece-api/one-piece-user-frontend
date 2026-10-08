import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MascotService } from '../../shared/mascot/mascot';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { pixels, pngFile } from '../../testing/png-file';
import { ENTITY } from '../entity/entities';
import { EntityEditor } from '../entity/entity-editor';
import { DEVIL_FRUIT } from './devil-fruit.model';

const ID = '3f2a9c1b-0000-4000-8000-000000000002';
const ENDPOINT = '/api/content/devil-fruits';
const SECTION = '/content/devil-fruits';
const LINKABLE = '/api/content/devil-fruit-types/linkable?size=20';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };

const LOGIA = { id: 't1', romaji: 'Shizen-kei', names: { it: 'Rogia', en: 'Logia' } };
const ZOAN = { id: 't2', romaji: 'Dobutsu-kei', names: { it: 'Zoo', en: 'Zoan' } };

/**
 * Stands in for the browser's decoding (`createImageBitmap`, `OffscreenCanvas`), which the
 * test DOM lacks: every image decodes to `decoded`. Undone by `vi.unstubAllGlobals()`.
 */
export function stubImageDecoding(decoded: Uint8ClampedArray): void {
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

/** Where the editor leads once it is done: not under test here. */
@Component({ template: '' })
class Elsewhere {}

describe('the editor of a Devil Fruit', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: DEVIL_FRUIT },
        provideRouter(
          [
            { path: 'content/devil-fruits/new', component: EntityEditor },
            { path: 'content/devil-fruits/:id/edit', component: EntityEditor },
            { path: 'content/devil-fruits/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    root = harness.routeNativeElement as HTMLElement;
    await settle();
  }

  function typeBox(): HTMLInputElement {
    return root.querySelector<HTMLInputElement>('#draft-type')!;
  }

  /** Opens the choice of type and answers the types that can be linked. */
  async function openChoices(found: object[]): Promise<void> {
    typeBox().dispatchEvent(new Event('focus'));
    harness.detectChanges();
    httpTesting.expectOne(LINKABLE).flush({
      content: found,
      page: 0,
      size: 20,
      totalElements: found.length,
      totalPages: 1,
    });
    await settle();
  }

  async function choose(index: number): Promise<void> {
    root.querySelectorAll<HTMLElement>('[data-testid="relation-choice"]')[index].click();
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

  function mascotSays(): string {
    return TestBed.inject(MascotService).message().text;
  }

  describe('a new content', () => {
    beforeEach(async () => {
      await open(`${SECTION}/new`);
    });

    it('offers the choice of type among the shared fields, empty at first', () => {
      expect(typeBox().getAttribute('role')).toBe('combobox');
      expect(typeBox().value).toBe('');
      expect(typeBox().placeholder).toBe('search and pick a type');
      expect(root.textContent).toContain('the type it belongs to');
    });

    it('asks for the type to be ready for review, right after the romaji', () => {
      expect(checks().slice(0, 3)).toEqual([
        '! Romaji · unique key required',
        '! Fruit type required',
        '! Name · Italiano required',
      ]);
      expect(root.textContent).toContain('Review takes a romaji, a type');
    });

    it('lists the types that can be linked, and ticks off the one chosen', async () => {
      await openChoices([LOGIA, ZOAN]);
      await choose(1);

      expect(typeBox().value).toBe('Zoan');
      expect(checks()[1]).toBe('✓ Fruit type complete');
    });

    it('creates the fruit with the id of the type chosen', async () => {
      await openChoices([LOGIA, ZOAN]);
      await choose(0);

      await save();
      const request = httpTesting.expectOne(ENDPOINT);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toMatchObject({ type: 't1' });
      request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
      await settle();
    });

    it('creates a draft with no type at all, as the backend lets it', async () => {
      await save();

      const request = httpTesting.expectOne(ENDPOINT);
      expect(request.request.body).toMatchObject({ type: null });
      request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
      await settle();
    });

    it('marks the type when the backend says it cannot be linked', async () => {
      await openChoices([LOGIA]);
      await choose(0);

      await save();
      httpTesting.expectOne(ENDPOINT).flush(
        {
          errorCode: 'CONTENT_VALUE_INVALID',
          errors: [
            { field: 'type', message: 'must be a Devil Fruit Type with an approved version' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await settle();

      const errors = Array.from(root.querySelectorAll('[data-testid="field-error"]')).map((error) =>
        error.textContent?.trim(),
      );
      expect(errors).toEqual(['this type can no longer be chosen']);
      expect(typeBox().getAttribute('aria-invalid')).toBe('true');
      expect(mascotSays()).toContain('cannot be linked');
    });

    it('forgets the refusal once another type is chosen', async () => {
      await openChoices([LOGIA, ZOAN]);
      await choose(0);
      await save();
      httpTesting.expectOne(ENDPOINT).flush(
        {
          errorCode: 'CONTENT_VALUE_INVALID',
          errors: [
            { field: 'type', message: 'must be a Devil Fruit Type with an approved version' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await settle();

      await openChoices([LOGIA, ZOAN]);
      await choose(1);

      expect(root.querySelector('[data-testid="field-error"]')).toBeNull();
    });
  });

  describe('a draft that has a type', () => {
    beforeEach(async () => {
      await open(`${SECTION}/${ID}/edit`);
      httpTesting.expectOne(`${ENDPOINT}/${ID}`).flush({
        id: ID,
        onlineVersionNumber: null,
        versions: [
          {
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
          },
        ],
      });
      await settle();
      httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`).flush({
        number: 1,
        status: 'DRAFT',
        author: NAMI,
        basedOn: null,
        claimant: null,
        everPublished: false,
        allowedActions: ['EDIT', 'DELETE', 'SUBMIT'],
        overrideActions: [],
        blockedActions: [],
        createdAt: '2026-10-01T08:00:00Z',
        updatedAt: '2026-10-01T08:00:00Z',
        rejectionReason: null,
        body: { romaji: 'Mera Mera no Mi', type: LOGIA, translations: {} },
      });
      await settle();
    });

    it('names the type it has without asking for the types that can be linked', () => {
      expect(typeBox().value).toBe('Logia');
      expect(checks()[1]).toBe('✓ Fruit type complete');
    });

    it('lets the type be taken away, and saves the draft with none', async () => {
      root.querySelector<HTMLButtonElement>('[data-testid="relation-clear"]')!.click();
      await settle();
      expect(typeBox().value).toBe('');

      await save();
      const request = httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toMatchObject({ type: null });
      request.flush({ number: 1 });
      await settle();
    });
  });

  describe('the image', () => {
    const SAVED_IMAGE = { id: 'a1b2', url: '/api/content/images/a1b2' };

    beforeEach(() => {
      stubImageDecoding(pixels(10, 5));
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:chosen');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    function preview(): HTMLImageElement | null {
      return root.querySelector<HTMLImageElement>('[data-testid="image-preview"]');
    }

    function imageError(): string | undefined {
      return root.querySelector('[data-testid="image-error"]')?.textContent?.trim();
    }

    /** Chooses a file from the disk, then waits for the checks to answer. */
    async function pick(file: File): Promise<void> {
      const input = root.querySelector<HTMLInputElement>('#draft-image')!;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      for (let round = 0; round < 3; round++) {
        await settle();
      }
    }

    describe('of a new content', () => {
      beforeEach(async () => {
        await open(`${SECTION}/new`);
      });

      it('offers the Media area with what the image must be, outside the checklist', () => {
        expect(root.textContent).toContain('Drop the main image here');
        expect(root.textContent).toContain(
          'PNG with a transparent background, 4:5, at least 320 × 400 px.',
        );
        expect(checks().join()).not.toContain('mage');
      });

      it('shows a file that passes the checks and sends it beside the JSON', async () => {
        await pick(pngFile(334, 400));
        expect(preview()?.getAttribute('src')).toBe('blob:chosen');

        await save();
        const request = httpTesting.expectOne(ENDPOINT);
        const form = request.request.body as FormData;
        expect(form).toBeInstanceOf(FormData);
        expect(form.get('image')).toBeInstanceOf(File);
        const version = form.get('version') as Blob;
        expect(version.type).toBe('application/json');
        expect(JSON.parse(await version.text())).toMatchObject({ type: null });
        request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
        await settle();
      });

      it('refuses a file before sending it, says why and sends the JSON alone', async () => {
        await pick(pngFile(300, 375));

        expect(imageError()).toBe('The image is 300 × 375: it must be at least 320 × 400.');
        expect(preview()).toBeNull();
        await save();
        const request = httpTesting.expectOne(ENDPOINT);
        expect(request.request.body).not.toBeInstanceOf(FormData);
        expect(request.request.body).not.toHaveProperty('removeImage');
        request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
        await settle();
      });

      it('tells the refusal of the backend under the image and keeps the file to retry', async () => {
        await pick(pngFile(334, 400));
        await save();
        httpTesting.expectOne(ENDPOINT).flush(
          {
            status: 422,
            errorCode: 'CONTENT_IMAGE_NOT_TRANSPARENT',
            field: 'image',
            transparentPercent: 2,
            minPercent: 5,
          },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
        await settle();

        expect(imageError()).toBe(
          'The background must be transparent: only 2% of this image is, at least 5% is needed.',
        );
        expect(mascotSays()).toContain("The image won't do");
        expect(preview()?.getAttribute('src')).toBe('blob:chosen');

        await save();
        const retry = httpTesting.expectOne(ENDPOINT);
        expect(retry.request.body).toBeInstanceOf(FormData);
        retry.flush({ id: ID, onlineVersionNumber: null, versions: [] });
        await settle();
      });

      it('tells a file cut off for its size by the upload limit', async () => {
        await pick(pngFile(334, 400));
        await save();
        httpTesting
          .expectOne(ENDPOINT)
          .flush(
            { status: 413, errorCode: 'CONTENT_TOO_LARGE', maxBytes: 10 * 1024 * 1024 },
            { status: 413, statusText: 'Content Too Large' },
          );
        await settle();

        expect(imageError()).toBe('The file is too heavy to send: the most is 10 MB.');
      });
    });

    describe('of a draft that has one', () => {
      beforeEach(async () => {
        await open(`${SECTION}/${ID}/edit`);
        httpTesting.expectOne(`${ENDPOINT}/${ID}`).flush({
          id: ID,
          onlineVersionNumber: null,
          versions: [
            {
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
            },
          ],
        });
        await settle();
        httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`).flush({
          number: 1,
          status: 'DRAFT',
          author: NAMI,
          basedOn: null,
          claimant: null,
          everPublished: false,
          allowedActions: ['EDIT', 'DELETE', 'SUBMIT'],
          overrideActions: [],
          blockedActions: [],
          createdAt: '2026-10-01T08:00:00Z',
          updatedAt: '2026-10-01T08:00:00Z',
          rejectionReason: null,
          body: { romaji: 'Mera Mera no Mi', type: LOGIA, image: SAVED_IMAGE, translations: {} },
        });
        await settle();
      });

      it('shows the saved image and keeps it on a save that does not touch it', async () => {
        expect(preview()?.getAttribute('src')).toBe(SAVED_IMAGE.url);

        await save();
        const request = httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`);
        expect(request.request.body).not.toBeInstanceOf(FormData);
        expect(request.request.body).not.toHaveProperty('removeImage');
        expect(request.request.body).not.toHaveProperty('image');
        request.flush({ number: 1 });
        await settle();
      });

      it('removes the image, and asks the backend to drop it', async () => {
        root.querySelector<HTMLButtonElement>('[data-testid="image-remove"]')!.click();
        await settle();
        expect(preview()).toBeNull();

        await save();
        const request = httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`);
        expect(request.request.body).toMatchObject({ removeImage: true });
        request.flush({ number: 1 });
        await settle();
      });

      it('lets go of the preview of a file replaced by another', async () => {
        await pick(pngFile(334, 400));
        await pick(pngFile(1280, 1600, 'bigger.png'));

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:chosen');
      });
    });
  });
});
