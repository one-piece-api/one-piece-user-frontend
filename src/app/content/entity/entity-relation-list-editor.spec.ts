import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { NOTE_WITH_PARTICIPANTS } from '../../testing/note-entity';
import { ENTITY } from './entities';
import { EntityEditor } from './entity-editor';
import type { EntityReference } from './entity-reference';

@Component({ template: '' })
class Elsewhere {}

const LINKABLE = '/api/content/devil-fruits/linkable?size=20';
const GOMU: EntityReference = { id: 'f1', romaji: 'Gomu Gomu no Mi', names: {} };
const MERA: EntityReference = { id: 'f2', romaji: 'Mera Mera no Mi', names: {} };

/** A list of contents in the editor, on an entity that exists only in the specs. */
describe('the editor of a relation list', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: NOTE_WITH_PARTICIPANTS },
        provideRouter(
          [
            { path: 'content/notes/new', component: EntityEditor },
            { path: 'content/notes/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/content/notes/new');
    harness.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([{ code: 'en', name: 'English' }]);
    await settle();
    root = harness.routeNativeElement as HTMLElement;
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

  const chips = () =>
    Array.from(root.querySelectorAll('[data-testid="relation-chip"]')).map((chip) =>
      chip.textContent?.replace('✕', '').trim(),
    );

  async function add(found: EntityReference[], index: number): Promise<void> {
    const box = root.querySelector<HTMLInputElement>('#draft-participants')!;
    box.dispatchEvent(new Event('focus'));
    harness.detectChanges();
    httpTesting.expectOne(LINKABLE).flush({
      content: found,
      page: 0,
      size: 20,
      totalElements: found.length,
      totalPages: 1,
    });
    await settle();
    root.querySelectorAll<HTMLElement>('[data-testid="relation-choice"]')[index].click();
    await settle();
  }

  it('adds the contents picked one after the other, and takes one off', async () => {
    await add([GOMU, MERA], 0);
    await add([GOMU, MERA], 1);
    await add([GOMU, MERA], 0);

    expect(chips()).toEqual(['Gomu Gomu no Mi', 'Mera Mera no Mi']);

    root.querySelector<HTMLButtonElement>('[data-testid="relation-chip"] button')!.click();
    await settle();

    expect(chips()).toEqual(['Mera Mera no Mi']);
  });

  it('saves the ids of the contents under their part', async () => {
    await add([GOMU, MERA], 1);
    const romaji = root.querySelector<HTMLInputElement>('#draft-romaji')!;
    romaji.value = 'Memo';
    romaji.dispatchEvent(new Event('input'));
    await settle();

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    const request = httpTesting.expectOne('/api/content/notes');
    expect(request.request.body).toMatchObject({ participants: { devilFruits: ['f2'] } });
    request.flush({ id: 'n1', onlineVersionNumber: null, versions: [] });
    await settle();
  });
});
