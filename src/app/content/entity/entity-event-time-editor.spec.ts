import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { NOTE_ON_TIMELINE } from '../../testing/note-entity';
import { ENTITY } from './entities';
import { EntityEditor } from './entity-editor';

@Component({ template: '' })
class Elsewhere {}

/** The time fields of the editor, on an entity that exists only in the specs. */
describe('the editor of an event time', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: NOTE_ON_TIMELINE },
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

  function time(key: string): HTMLElement {
    return root.querySelector<HTMLElement>(`[data-testid="event-time-${key}"]`)!;
  }

  async function pickYears(key: string, from: string, to = '', approximate = false) {
    time(key).querySelector<HTMLButtonElement>('[data-testid="event-time-mode-year"]')!.click();
    await settle();
    for (const [part, year] of [
      ['yearFrom', from],
      ['yearTo', to],
    ]) {
      const input = root.querySelector<HTMLInputElement>(`#draft-${key}-${part}`)!;
      input.value = year;
      input.dispatchEvent(new Event('input'));
    }
    if (approximate) {
      root.querySelector<HTMLInputElement>(`#draft-${key}-approximate`)!.click();
    }
    await settle();
  }

  function errorOf(key: string): string | null {
    return time(key).querySelector('[data-testid="field-error"]')?.textContent?.trim() ?? null;
  }

  async function save() {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    return httpTesting.expectOne('/api/content/notes');
  }

  it('starts in the story, on a chapter, and switches to a year before it', async () => {
    const modes = () =>
      Array.from(time('occursAt').querySelectorAll('[role="radio"]')).map((mode) => [
        mode.textContent?.trim(),
        mode.getAttribute('aria-checked'),
      ]);

    expect(modes()).toEqual([
      ['In the story (chapter)', 'true'],
      ['Before the story (year)', 'false'],
    ]);
    expect(root.querySelector('#draft-occursAt')?.getAttribute('role')).toBe('combobox');

    await pickYears('occursAt', '700', '800', true);
    expect(modes()[1][1]).toBe('true');
    expect(
      time('occursAt').querySelector('[data-testid="event-time-preview"]')?.textContent,
    ).toMatch(/c\. 700–800\s+about 722–822 years before the story begins/);
  });

  it('saves the world date of the year mode, and nothing for a time left empty', async () => {
    await pickYears('occursAt', ' 1500 ', '', true);

    const request = await save();
    expect(request.request.body).toMatchObject({
      occursAt: { worldDate: { yearFrom: 1500, yearTo: null, approximate: true } },
      endsAt: null,
    });
    request.flush({ id: 'n1', onlineVersionNumber: null, versions: [] });
    await settle();
  });

  it('says at once what the backend would refuse', async () => {
    await pickYears('occursAt', '1530');
    expect(errorOf('occursAt')).toBe(
      'A year before the story cannot be later than the year the story begins.',
    );

    await pickYears('occursAt', '1500');
    await pickYears('endsAt', '1400');
    expect(errorOf('occursAt')).toBeNull();
    expect(errorOf('endsAt')).toBe('This date comes before “When it happens”.');
  });

  it('shows a refusal of the backend under the time it names', async () => {
    await pickYears('occursAt', '1500');
    await pickYears('endsAt', '1510', '1505');

    (await save()).flush(
      {
        errorCode: 'VALIDATION_FAILED',
        errors: [{ field: 'endsAt.worldDate', message: 'must not be before yearFrom' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();

    expect(errorOf('endsAt')).toBe('The last year comes before the first.');
  });
});
