import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MascotService } from '../../shared/mascot/mascot';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import type { VersionAction, VersionStatus } from '../content.model';
import { DevilFruitTypeEditor } from './devil-fruit-type-editor';

const ID = '3f2a9c1b-0000-4000-8000-000000000001';
const ENDPOINT = '/api/content/devil-fruit-types';
const DETAIL = `${ENDPOINT}/${ID}`;
const SECTION = '/content/devil-fruit-types';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };

/** Where the editor leads once it is done: not under test here. */
@Component({ template: '' })
class Elsewhere {}

function link(number: number, status: VersionStatus, allowedActions: VersionAction[] = []) {
  return {
    number,
    status,
    author: NAMI,
    basedOn: number === 1 ? null : number - 1,
    claimant: null,
    everPublished: status === 'PUBLISHED',
    allowedActions,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };
}

/** v1 online, v2 nami's own draft. */
const ONLINE = link(1, 'PUBLISHED', ['OPEN_NEW_VERSION']);
const DRAFT = link(2, 'DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);

const DRAFT_BODY = {
  romaji: 'Shizen-kei',
  translations: {
    it: { name: 'Rogia', description: 'Elementale.' },
    en: { name: 'Logia', description: null },
  },
};

polyfillDialog();

describe('DevilFruitTypeEditor', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'content/devil-fruit-types/new', component: DevilFruitTypeEditor },
            { path: 'content/devil-fruit-types/:id/edit', component: DevilFruitTypeEditor },
            { path: 'content/devil-fruit-types/:id', component: Elsewhere },
            { path: 'content/devil-fruit-types', component: Elsewhere },
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

  /** Opens the editor at `url` and answers the language catalog. */
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

  /** Opens nami's draft v2: the content, then the version it can edit. */
  async function openDraft(): Promise<void> {
    await open(`${SECTION}/${ID}/edit`);
    httpTesting
      .expectOne(DETAIL)
      .flush({ id: ID, onlineVersionNumber: 1, versions: [ONLINE, DRAFT] });
    await settle();
    httpTesting
      .expectOne(`${DETAIL}/versions/2`)
      .flush({ ...DRAFT, rejectionReason: null, body: DRAFT_BODY });
    await settle();
  }

  /**
   * Lets the answers and the signals settle. Not `whenStable`: a request left pending on
   * purpose would keep the page from ever being stable.
   */
  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  function field(id: 'draft-romaji' | 'draft-name' | 'draft-description') {
    return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
  }

  async function type(id: 'draft-romaji' | 'draft-name' | 'draft-description', text: string) {
    const input = field(id);
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  function tab(label: string): HTMLButtonElement {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((candidate) =>
      candidate.textContent?.trim().startsWith(label),
    )!;
  }

  async function pickLanguage(label: string): Promise<void> {
    tab(label).click();
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

  function fieldErrors(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="field-error"]')).map(
      (error) => error.textContent?.trim() ?? '',
    );
  }

  function mascotSays(): string {
    return TestBed.inject(MascotService).message().text;
  }

  function cancelHref(): string | null {
    return Array.from(root.querySelectorAll('a'))
      .find((anchor) => anchor.textContent?.trim() === 'Cancel')!
      .getAttribute('href');
  }

  describe('a new content', () => {
    it('starts empty, named "new" and created by its first save', async () => {
      await open(`${SECTION}/new`);

      expect(root.querySelector('h1')?.textContent?.trim()).toBe('New fruit type');
      expect(root.textContent).toContain('new draft · created by its first save');
      expect(root.textContent).toContain('Editing · Draft');
      expect(field('draft-romaji').value).toBe('');
      expect(cancelHref()).toBe(SECTION);
    });

    it('asks for the romaji and, in every language of the catalog, a name and a description', async () => {
      await open(`${SECTION}/new`);

      expect(checks()).toEqual([
        '! Romaji · unique key required',
        '! Name · Italiano required',
        '! Description · Italiano required',
        '! Name · English required',
        '! Description · English required',
      ]);
      expect(root.textContent).toContain('Review takes a romaji');
    });

    it('ticks off what is written and takes its title from the name in the UI language', async () => {
      await open(`${SECTION}/new`);

      await type('draft-romaji', 'Shizen-kei');
      expect(root.querySelector('h1')?.textContent?.trim()).toBe('Shizen-kei');
      await type('draft-name', 'Logia');

      expect(root.querySelector('h1')?.textContent?.trim()).toBe('Logia');
      expect(checks()[0]).toBe('✓ Romaji · unique key complete');
      expect(checks()[3]).toBe('✓ Name · English complete');
    });

    it('keeps each language its own: the tabs switch what is shown and say what is incomplete', async () => {
      await open(`${SECTION}/new`);
      await type('draft-name', 'Logia');
      await type('draft-description', 'Elemental.');

      expect(tab('EN').textContent).not.toContain('incomplete');
      expect(tab('IT').textContent).toContain('incomplete');
      await pickLanguage('IT');
      expect(field('draft-name').value).toBe('');
      await type('draft-name', 'Rogia');
      await pickLanguage('EN');

      expect(field('draft-name').value).toBe('Logia');
    });

    it('creates the content with what was written, incomplete as it is, then shows it', async () => {
      await open(`${SECTION}/new`);
      await type('draft-romaji', '  Shizen-kei ');
      await type('draft-name', 'Logia');

      await save();
      const request = httpTesting.expectOne(ENDPOINT);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        romaji: 'Shizen-kei',
        translations: {
          it: { name: null, description: null },
          en: { name: 'Logia', description: null },
        },
      });
      request.flush({ id: ID, onlineVersionNumber: null, versions: [link(1, 'DRAFT', ['EDIT'])] });
      await settle();

      expect(TestBed.inject(Router).url).toBe(`${SECTION}/${ID}`);
      expect(mascotSays()).toContain('New draft aboard');
    });

    it('marks the fields already taken by another content and the language they are in', async () => {
      await open(`${SECTION}/new`);
      await type('draft-romaji', 'Zoan');

      await save();
      httpTesting.expectOne(ENDPOINT).flush(
        {
          errorCode: 'CONTENT_VALUE_ALREADY_USED',
          errors: [
            { field: 'romaji', message: 'is already used by another content' },
            { field: 'translations[it].name', message: 'is already used by another content' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await settle();

      expect(TestBed.inject(Router).url).toBe(`${SECTION}/new`);
      expect(fieldErrors()).toEqual(['already used by another content']);
      expect(tab('IT').textContent).toContain('to fix');
      expect(tab('EN').textContent).not.toContain('to fix');
      expect(mascotSays()).toContain('must be unique');
      await pickLanguage('IT');
      expect(fieldErrors()).toEqual([
        'already used by another content',
        'already used by another content',
      ]);
    });

    it('forgets a refusal once its field is written again', async () => {
      await open(`${SECTION}/new`);
      await save();
      httpTesting.expectOne(ENDPOINT).flush(
        {
          errorCode: 'CONTENT_VALUE_ALREADY_USED',
          errors: [{ field: 'romaji', message: 'is already used by another content' }],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await settle();

      await type('draft-romaji', 'Chojin-kei');

      expect(fieldErrors()).toEqual([]);
    });

    it('limits each text to what the backend accepts', async () => {
      await open(`${SECTION}/new`);

      expect(field('draft-romaji').maxLength).toBe(100);
      expect(field('draft-name').maxLength).toBe(100);
      expect(field('draft-description').maxLength).toBe(2000);
    });
  });

  describe('an existing draft', () => {
    it('opens the version the caller may edit, with what it says', async () => {
      await openDraft();

      expect(root.querySelector('h1')?.textContent?.trim()).toBe('Logia');
      expect(root.textContent).toContain('your draft v2 · v1 stays online');
      expect(field('draft-romaji').value).toBe('Shizen-kei');
      expect(field('draft-name').value).toBe('Logia');
      expect(field('draft-description').value).toBe('');
      expect(tab('EN').textContent).toContain('incomplete');
      expect(tab('IT').textContent).not.toContain('incomplete');
      expect(cancelHref()).toBe(`${SECTION}/${ID}`);
    });

    it('saves the whole draft in place of the version, then shows it', async () => {
      await openDraft();
      await type('draft-description', 'Elemental.');

      await save();
      const request = httpTesting.expectOne(`${DETAIL}/versions/2`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        romaji: 'Shizen-kei',
        translations: {
          it: { name: 'Rogia', description: 'Elementale.' },
          en: { name: 'Logia', description: 'Elemental.' },
        },
      });
      request.flush({ ...DRAFT, rejectionReason: null, body: DRAFT_BODY });
      await settle();

      expect(TestBed.inject(Router).url).toBe(`${SECTION}/${ID}?v=2`);
      expect(mascotSays()).toContain('Draft saved');
    });

    it('says so when the version is no longer a draft', async () => {
      await openDraft();

      await save();
      httpTesting
        .expectOne(`${DETAIL}/versions/2`)
        .flush(
          { errorCode: 'CONTENT_VERSION_ACTION_CONFLICT' },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();

      expect(mascotSays()).toContain('no longer a draft');
      expect(TestBed.inject(Router).url).toBe(`${SECTION}/${ID}/edit`);
    });

    it('has nothing to edit when no version of the content is the caller’s draft', async () => {
      await open(`${SECTION}/${ID}/edit`);
      httpTesting.expectOne(DETAIL).flush({ id: ID, onlineVersionNumber: 1, versions: [ONLINE] });
      await settle();

      expect(root.textContent).toContain('Nothing to edit here');
      expect(root.querySelector('form')).toBeNull();
    });

    it('says the content is not there when the caller cannot see it', async () => {
      await open(`${SECTION}/${ID}/edit`);
      httpTesting
        .expectOne(DETAIL)
        .flush(
          { errorCode: 'CONTENT_DEVIL_FRUIT_TYPE_NOT_FOUND' },
          { status: 404, statusText: '' },
        );
      await settle();

      expect(root.textContent).toContain('Content not found');
    });
  });

  describe('discarding the draft', () => {
    /** Opens a content whose only version is nami's first draft. */
    async function openFirstDraft(): Promise<void> {
      await open(`${SECTION}/${ID}/edit`);
      const first = link(1, 'DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);
      httpTesting.expectOne(DETAIL).flush({ id: ID, onlineVersionNumber: null, versions: [first] });
      await settle();
      httpTesting
        .expectOne(`${DETAIL}/versions/1`)
        .flush({ ...first, rejectionReason: null, body: DRAFT_BODY });
      await settle();
    }

    function discardButton(): HTMLButtonElement | null {
      return root.querySelector('[data-testid="discard-draft"]');
    }

    function confirmation(): HTMLDialogElement {
      return root.querySelector('app-confirm-dialog dialog')!;
    }

    async function confirm(): Promise<void> {
      confirmation().querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')!.click();
      await settle();
    }

    async function askToDiscard(): Promise<void> {
      discardButton()!.click();
      await settle();
    }

    it('is not offered for a content not saved yet', async () => {
      await open(`${SECTION}/new`);

      expect(discardButton()).toBeNull();
    });

    it('is not offered when the backend does not allow it', async () => {
      await open(`${SECTION}/${ID}/edit`);
      const editOnly = link(2, 'DRAFT', ['EDIT']);
      httpTesting
        .expectOne(DETAIL)
        .flush({ id: ID, onlineVersionNumber: 1, versions: [ONLINE, editOnly] });
      await settle();
      httpTesting
        .expectOne(`${DETAIL}/versions/2`)
        .flush({ ...editOnly, rejectionReason: null, body: DRAFT_BODY });
      await settle();

      expect(root.querySelector('form')).not.toBeNull();
      expect(discardButton()).toBeNull();
    });

    it('asks first, saying the content goes back to the version before', async () => {
      await openDraft();

      await askToDiscard();

      expect(confirmation().open).toBe(true);
      expect(confirmation().textContent).toContain('Discard the draft of "Logia"?');
      expect(confirmation().textContent).toContain('goes back to how it was in v1');
      expect(confirmation().textContent).toContain('only the line in the ship’s log remains');
    });

    it('asks first, saying a first draft goes away entirely', async () => {
      await openFirstDraft();

      await askToDiscard();

      expect(confirmation().textContent).toContain('Discard the draft "Logia"?');
      expect(confirmation().textContent).toContain('it will be removed entirely');
    });

    it('does nothing when the editor thinks better of it', async () => {
      await openDraft();
      await askToDiscard();

      confirmation().close();
      await settle();

      expect(confirmation().open).toBe(false);
      expect(TestBed.inject(Router).url).toBe(`${SECTION}/${ID}/edit`);
    });

    it('removes a later draft and shows the content at the version left', async () => {
      await openDraft();
      await askToDiscard();

      await confirm();
      const request = httpTesting.expectOne(`${DETAIL}/versions/2`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(TestBed.inject(Router).url).toBe(`${SECTION}/${ID}`);
      expect(mascotSays()).toBe('Draft discarded: v1 remains.');
    });

    it('removes a first draft with its content and goes back to the list', async () => {
      await openFirstDraft();
      await askToDiscard();

      await confirm();
      httpTesting
        .expectOne(`${DETAIL}/versions/1`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(TestBed.inject(Router).url).toBe(SECTION);
      expect(mascotSays()).toBe('Draft removed.');
    });

    it('says so when the version is no longer a draft, and closes the question', async () => {
      await openDraft();
      await askToDiscard();

      await confirm();
      httpTesting
        .expectOne(`${DETAIL}/versions/2`)
        .flush(
          { errorCode: 'CONTENT_VERSION_ACTION_CONFLICT' },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();

      expect(confirmation().open).toBe(false);
      expect(mascotSays()).toContain('no longer a draft');
      expect(TestBed.inject(Router).url).toBe(`${SECTION}/${ID}/edit`);
    });
  });
});
