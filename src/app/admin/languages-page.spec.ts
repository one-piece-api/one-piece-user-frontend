import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LanguageEntry } from '../content/language-catalog';
import { MascotService } from '../shared/mascot/mascot';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { LanguagesPage } from './languages-page';

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

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

/** The <dialog> stays mounted permanently (see Modal) - pick it out by its heading text. */
function dialogByHeading(root: HTMLElement, heading: string): HTMLDialogElement {
  const dialog = Array.from(root.querySelectorAll('dialog')).find(
    (d) => d.querySelector('h2')?.textContent?.trim() === heading,
  );
  return dialog as HTMLDialogElement;
}

const DEFAULT_LANGUAGES: LanguageEntry[] = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
];

describe('LanguagesPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguagesPage, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function createAndLoad(
    languages: LanguageEntry[] = DEFAULT_LANGUAGES,
  ): Promise<ComponentFixture<LanguagesPage>> {
    const fixture = TestBed.createComponent(LanguagesPage);
    fixture.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush(languages);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists every language in the catalog', async () => {
    const fixture = await createAndLoad([
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'Français' },
      { code: 'it', name: 'Italiano' },
    ]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('English');
    expect(root.textContent).toContain('Français');
    expect(root.textContent).toContain('Italiano');
  });

  it('shows an empty state when the catalog is empty', async () => {
    const fixture = await createAndLoad([]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No languages in the catalog yet.');
  });

  it('creates a language and reloads the catalog', async () => {
    const fixture = await createAndLoad();
    const mascotService = TestBed.inject(MascotService);
    const root = fixture.nativeElement as HTMLElement;

    const newButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'New Language',
    );
    newButton!.click();
    fixture.detectChanges();

    const dialog = dialogByHeading(root, 'New Language');
    setValue(dialog.querySelector<HTMLInputElement>('#language-name')!, 'Français');
    setValue(dialog.querySelector<HTMLInputElement>('#language-code')!, 'fr');
    fixture.detectChanges();

    const form = dialog.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    const createReq = httpTesting.expectOne('/api/content/languages');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({ code: 'fr', name: 'Français' });
    createReq.flush({ code: 'fr', name: 'Français' });
    await fixture.whenStable();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/content/languages')
      .flush([...DEFAULT_LANGUAGES, { code: 'fr', name: 'Français' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Language Français (fr) added to the catalog!',
        tone: 'success',
      }),
    );
  });

  it('rejects a code that is not exactly two letters', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'New Language',
    );
    newButton!.click();
    fixture.detectChanges();

    const dialog = dialogByHeading(root, 'New Language');
    setValue(dialog.querySelector<HTMLInputElement>('#language-name')!, 'French');
    setValue(dialog.querySelector<HTMLInputElement>('#language-code')!, 'fra');
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(dialog.textContent).toContain('Use exactly 2 letters');
    httpTesting.expectNone('/api/content/languages');
  });

  it('shows a specific message when creating a duplicate language fails', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'New Language',
    );
    newButton!.click();
    fixture.detectChanges();

    const dialog = dialogByHeading(root, 'New Language');
    setValue(dialog.querySelector<HTMLInputElement>('#language-name')!, 'Italiano');
    setValue(dialog.querySelector<HTMLInputElement>('#language-code')!, 'it');
    fixture.detectChanges();
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/content/languages')
      .flush(
        { errorCode: 'CONTENT_LANGUAGE_ALREADY_EXISTS', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialog.textContent).toContain('Language it already exists.');
  });

  it('deletes a language after confirming', async () => {
    const fixture = await createAndLoad([
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'Français' },
      { code: 'it', name: 'Italiano' },
    ]);
    const mascotService = TestBed.inject(MascotService);
    const root = fixture.nativeElement as HTMLElement;

    const deleteButton = root.querySelector<HTMLButtonElement>('[aria-label="Delete language fr"]');
    deleteButton!.click();
    fixture.detectChanges();

    const dialog = dialogByHeading(root, 'Delete Language');
    const confirmButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Delete Language',
    );
    confirmButton!.click();
    fixture.detectChanges();

    const deleteReq = httpTesting.expectOne('/api/content/languages/fr');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    fixture.detectChanges();

    httpTesting.expectOne('/api/content/languages').flush(DEFAULT_LANGUAGES);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: 'Language fr removed from the catalog.', tone: 'success' }),
    );
  });

  it('shows a blocked message when deleting a language still in use is refused', async () => {
    const fixture = await createAndLoad([
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'Français' },
      { code: 'it', name: 'Italiano' },
    ]);
    const mascotService = TestBed.inject(MascotService);
    const root = fixture.nativeElement as HTMLElement;

    const deleteButton = root.querySelector<HTMLButtonElement>('[aria-label="Delete language it"]');
    deleteButton!.click();
    fixture.detectChanges();

    const dialog = dialogByHeading(root, 'Delete Language');
    const confirmButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Delete Language',
    );
    confirmButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/content/languages/it')
      .flush(
        { errorCode: 'CONTENT_LANGUAGE_IN_USE', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: "Arrr! it is still used by existing content — it can't be removed yet.",
        tone: 'error',
      }),
    );
  });
});
