import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { NOTE } from '../../testing/note-entity';
import { ENTITY } from './entities';
import { EntityEditor } from './entity-editor';
import { EntityList } from './entity-list';

/** Where a page leads once it is done: not under test here. */
@Component({ template: '' })
class Elsewhere {}

/**
 * The list and the editor, run with an entity that exists only in the specs: they talk to
 * its API, show its texts and its fields - nothing of the Devil Fruit Type. What they do
 * is covered by the type's own specs.
 */
describe('the pages of any entity', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: NOTE },
        provideRouter(
          [
            { path: 'content/notes', component: EntityList },
            { path: 'content/notes/new', component: EntityEditor },
            { path: 'content/notes/:id', component: Elsewhere },
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

  it('lists the contents of the entity from its own API, under its own title', async () => {
    harness = await RouterTestingHarness.create('/content/notes');
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read'],
    });
    httpTesting.expectOne('/api/content/notes/summary').flush({
      total: 1,
      mine: 0,
      statuses: ['PUBLISHED'],
    });
    httpTesting.expectOne('/api/content/notes/authors').flush([]);
    httpTesting.expectOne('/api/content/notes?page=0').flush({
      content: [
        {
          id: 'n1',
          versionNumber: 1,
          status: 'PUBLISHED',
          author: { id: 'u1', username: 'nami', email: 'nami@onepiece.local' },
          updatedAt: '2026-10-01T08:00:00Z',
          onlineVersionNumber: 1,
          body: { romaji: 'Memo', names: { en: 'Note' } },
          allowedActions: [],
          overrideActions: [],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await settle();
    root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('content.notes.title');
    expect(root.querySelector('h1 img, h1 app-icon')?.textContent).toContain('✎');
    const row = root.querySelector('[data-testid="content-row"]');
    expect(row?.textContent).toContain('Note');
    expect(row?.querySelector('a')?.getAttribute('href')).toBe('/content/notes/n1');
  });

  describe('the editor', () => {
    beforeEach(async () => {
      harness = await RouterTestingHarness.create('/content/notes/new');
      harness.detectChanges();
      httpTesting.expectOne('/api/content/languages').flush([
        { code: 'it', name: 'Italiano' },
        { code: 'en', name: 'English' },
      ]);
      await settle();
      root = harness.routeNativeElement as HTMLElement;
    });

    function field(key: string) {
      return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#draft-${key}`)!;
    }

    async function type(key: string, text: string): Promise<void> {
      field(key).value = text;
      field(key).dispatchEvent(new Event('input'));
      await settle();
    }

    it('offers the fields of the entity, as their kind and limits say', () => {
      expect(root.querySelector('h1')?.textContent?.trim()).toBe('content.notes.newTitle');
      expect(field('romaji').tagName).toBe('INPUT');
      expect(field('code').tagName).toBe('INPUT');
      expect(field('code').maxLength).toBe(8);
      expect(field('name').tagName).toBe('INPUT');
      expect(field('name').maxLength).toBe(60);
      expect(field('body').tagName).toBe('TEXTAREA');
      expect((field('body') as HTMLTextAreaElement).rows).toBe(4);
      expect(field('body').placeholder).toBe('content.notes.placeholder.body');
      expect(root.querySelector('#draft-description')).toBeNull();
    });

    it('creates the content with every field of the entity', async () => {
      await type('romaji', ' Memo ');
      await type('code', 'N-1');
      await type('name', 'Note');
      await type('body', 'Text.');

      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
      const request = httpTesting.expectOne('/api/content/notes');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        romaji: 'Memo',
        code: 'N-1',
        translations: { it: { name: null, body: null }, en: { name: 'Note', body: 'Text.' } },
      });
      request.flush({ id: 'n1', onlineVersionNumber: null, versions: [] });
      await settle();
    });
  });
});
