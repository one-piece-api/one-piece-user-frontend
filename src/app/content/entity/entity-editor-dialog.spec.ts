import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { NOTE_IN_DIALOG } from '../../testing/note-entity';
import { ENTITY } from './entities';
import { EditorDialogHost, EditorDialogs } from './entity-editor-dialog';
import { EntityList } from './entity-list';

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

/** Where a page leads once it is done: not under test here. */
@Component({ template: '' })
class Elsewhere {}

/**
 * The editor of an entity written in a dialog, on an entity that exists only in the specs:
 * opened over its list, with nothing of a page around it.
 */
describe('the editor in a dialog', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let host: ComponentFixture<EditorDialogHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: NOTE_IN_DIALOG },
        provideRouter(
          [
            { path: 'content/notes', component: EntityList },
            { path: 'content/notes/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    host = TestBed.createComponent(EditorDialogHost);
    harness = await RouterTestingHarness.create('/content/notes');
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read', 'content:write'],
    });
    httpTesting.expectOne('/api/content/notes/summary').flush({ total: 0, mine: 0, statuses: [] });
    httpTesting.expectOne('/api/content/notes/authors').flush([]);
    httpTesting
      .expectOne('/api/content/notes?page=0')
      .flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    await settle();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
      host.detectChanges();
    }
  }

  const page = () => harness.routeNativeElement as HTMLElement;
  const dialog = () =>
    (host.nativeElement as HTMLElement).querySelector<HTMLDialogElement>(
      '[data-testid="editor-dialog"]',
    );

  async function openNew(): Promise<void> {
    page().querySelector<HTMLButtonElement>('[data-testid="new-content"]')!.click();
    await settle();
    httpTesting.expectOne('/api/content/languages').flush([{ code: 'en', name: 'English' }]);
    await settle();
  }

  it('opens over the list from "new", with the editor and no breadcrumb', async () => {
    expect(page().querySelector('a[href="/content/notes/new"]')).toBeNull();

    await openNew();

    expect(dialog()?.open).toBe(true);
    expect(dialog()?.querySelector('h1')?.textContent?.trim()).toBe('content.notes.newTitle');
    expect(dialog()?.querySelector('app-breadcrumb')).toBeNull();
    expect(dialog()?.querySelector('#draft-romaji')).not.toBeNull();
  });

  it('closes on "cancel", leaving the list where it was', async () => {
    await openNew();

    dialog()!.querySelector<HTMLButtonElement>('[data-testid="editor-cancel"]')!.click();
    await settle();

    expect(dialog()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/content/notes');
  });

  it('starts a new content with what it is opened with', async () => {
    TestBed.inject(EditorDialogs).open({ entity: NOTE_IN_DIALOG, preset: { code: 'N-7' } });
    await settle();
    httpTesting.expectOne('/api/content/languages').flush([{ code: 'en', name: 'English' }]);
    await settle();

    expect(dialog()?.querySelector<HTMLInputElement>('#draft-code')?.value).toBe('N-7');
    dialog()!.querySelector<HTMLButtonElement>('[data-testid="editor-cancel"]')!.click();
    await settle();
  });

  it('creates the content, then closes and shows it', async () => {
    await openNew();
    const romaji = dialog()!.querySelector<HTMLInputElement>('#draft-romaji')!;
    romaji.value = 'Memo';
    romaji.dispatchEvent(new Event('input'));
    await settle();

    dialog()!
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const request = httpTesting.expectOne('/api/content/notes');
    expect(request.request.body).toMatchObject({ romaji: 'Memo' });
    request.flush({ id: 'n1', onlineVersionNumber: null, versions: [] });
    await settle();

    expect(dialog()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/content/notes/n1');
  });
});
