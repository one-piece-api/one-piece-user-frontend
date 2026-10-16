import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { NOTE_REVEALED } from '../../testing/note-entity';
import { ENTITY } from './entities';
import { EntityEditor } from './entity-editor';
import type { EntityReference } from './entity-reference';

@Component({ template: '' })
class Elsewhere {}

const LINKABLE = '/api/content/chapters/linkable?size=20';
const ONE: EntityReference = { id: 'c1', number: 1, names: { en: 'Romance Dawn' } };
const TWO: EntityReference = { id: 'c2', number: 2, names: { en: 'They Call Him Luffy' } };

/** A story point that starts from the chapter of a time, on an entity of the specs. */
describe('a reveal that follows when it happens', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: NOTE_REVEALED },
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

  async function pick(inputId: string, chapter: EntityReference): Promise<void> {
    root.querySelector<HTMLInputElement>(`#${inputId}`)!.dispatchEvent(new Event('focus'));
    harness.detectChanges();
    httpTesting
      .expectOne(LINKABLE)
      .flush({ content: [ONE, TWO], page: 0, size: 20, totalElements: 2, totalPages: 1 });
    await settle();
    const choices = root.querySelectorAll<HTMLElement>('[data-testid="relation-choice"]');
    choices[chapter === ONE ? 0 : 1].click();
    await settle();
  }

  const revealed = () => root.querySelector<HTMLInputElement>('#draft-revealedAt')!.value;

  it('takes the chapter it happens in, and follows it while left alone', async () => {
    await pick('draft-occursAt', ONE);
    expect(revealed()).toContain('Romance Dawn');

    await pick('draft-occursAt', TWO);
    expect(revealed()).toContain('They Call Him Luffy');
  });

  it('stays where it was put apart', async () => {
    await pick('draft-occursAt', ONE);
    await pick('draft-revealedAt', TWO);

    await pick('draft-occursAt', ONE);
    expect(revealed()).toContain('They Call Him Luffy');
  });
});
