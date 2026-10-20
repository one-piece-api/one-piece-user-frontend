import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ENTITY } from '../entity/entities';
import { EntityCard } from '../entity/entity-card';
import type { EntityBody } from '../entity/entity-body';
import { DEVIL_FRUIT_TYPE } from './devil-fruit-type.model';

const ITALIAN = { code: 'it', name: 'Italiano' };
const ENGLISH = { code: 'en', name: 'English' };

/** Complete in English; in Italian, still without a description and disadvantages. */
const LOGIA: EntityBody = {
  romaji: 'Shizen-kei',
  translations: {
    en: {
      name: 'Logia',
      description: 'Turns the body into an element.',
      advantages: 'Attacks pass through.',
      disadvantages: 'Haki and sea water.',
    },
    it: { name: 'Rogia', description: null, advantages: 'Intangibile.', disadvantages: null },
  },
};

describe('DevilFruitTypeCard', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: DEVIL_FRUIT_TYPE }],
    });
  });

  function render(devilFruitType: EntityBody, languages = [ITALIAN, ENGLISH]): void {
    fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', devilFruitType);
    fixture.componentRef.setInput('languages', languages);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function tabs(): HTMLButtonElement[] {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }

  function text(testId: string): string {
    return root.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';
  }

  it('offers one tab per language of the catalog', () => {
    render(LOGIA);

    expect(tabs().map((tab) => tab.textContent?.trim().slice(0, 2))).toEqual(['IT', 'EN']);
  });

  it('opens on the language the UI is in', () => {
    render(LOGIA);

    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(text('card-name')).toBe('Logia');
    expect(text('card-description')).toBe('Turns the body into an element.');
    expect(text('card-advantages')).toBe('Attacks pass through.');
    expect(text('card-disadvantages')).toBe('Haki and sea water.');
    expect(root.textContent).toContain('Description');
    expect(root.textContent).toContain('Advantages');
    expect(root.textContent).toContain('Disadvantages');
  });

  it('opens on the first language when the catalog does not have the UI one', () => {
    render(LOGIA, [ITALIAN]);

    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(text('card-name')).toBe('Rogia');
  });

  it('switches to the language that is picked', () => {
    render(LOGIA);

    tabs()[0].click();
    fixture.detectChanges();

    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(text('card-name')).toBe('Rogia');
    expect(text('card-description')).toBe('— no description in this language —');
    expect(text('card-advantages')).toBe('Intangibile.');
    expect(text('card-disadvantages')).toBe('— no disadvantages in this language —');
  });

  it('marks the languages whose translation is incomplete', () => {
    render(LOGIA);

    const marked = tabs().map(
      (tab) => tab.querySelector('[data-testid="incomplete-marker"]') !== null,
    );
    expect(marked).toEqual([true, false]);
  });

  it('marks a language of the catalog the version has no translation for', () => {
    render({ romaji: 'Shizen-kei', translations: { en: LOGIA.translations['en'] } });

    expect(tabs()[0].querySelector('[data-testid="incomplete-marker"]')).not.toBeNull();
  });

  it('keeps the picked language when another version is shown', () => {
    render(LOGIA);
    tabs()[0].click();

    fixture.componentRef.setInput('body', {
      romaji: 'Shizen-kei',
      translations: {
        it: { name: 'Rogia v2', description: 'Elementale.', advantages: null, disadvantages: null },
      },
    });
    fixture.detectChanges();

    expect(text('card-name')).toBe('Rogia v2');
  });
});

describe('DevilFruitTypeCard, the first appearances', () => {
  const ROMANCE_DAWN = { id: 'c1', number: 1, names: { en: 'Romance Dawn' } };

  it('names the chapter of the type and of each subcategory, each leading to its page', () => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: DEVIL_FRUIT_TYPE }],
    });
    const fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', {
      ...LOGIA,
      firstAppearance: { chapter: ROMANCE_DAWN },
      subcategories: [
        {
          id: 's1',
          translations: { en: { name: 'Ancient', description: 'Extinct.' } },
          firstAppearance: { chapter: ROMANCE_DAWN },
        },
        { id: 's2', translations: { en: { name: 'Mythical', description: 'Legends.' } } },
      ],
    });
    fixture.componentRef.setInput('languages', [ENGLISH]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const typeChapter = root.querySelector<HTMLAnchorElement>(
      '[data-testid="card-firstAppearance"]',
    );
    const subcategoryChapters = root.querySelectorAll<HTMLAnchorElement>(
      '[data-testid="card-subcategory-firstAppearance"]',
    );
    expect(typeChapter?.textContent?.trim()).toBe('Ch. 1 — Romance Dawn');
    expect(typeChapter?.getAttribute('href')).toBe('/content/chapters/c1');
    expect(subcategoryChapters).toHaveLength(1);
    expect(subcategoryChapters[0].textContent?.trim()).toBe('Ch. 1 — Romance Dawn');
  });

  it('names the episode beside the chapter, and a subcategory seen only in the anime', () => {
    const EPISODE_4 = { id: 'e4', number: 4, names: { en: 'Luffy’s Past' } };
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: DEVIL_FRUIT_TYPE }],
    });
    const fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', {
      ...LOGIA,
      firstAppearance: { chapter: ROMANCE_DAWN, episode: EPISODE_4 },
      subcategories: [
        {
          id: 's1',
          translations: { en: { name: 'Ancient', description: 'Extinct.' } },
          firstAppearance: { chapter: null, episode: EPISODE_4 },
        },
      ],
    });
    fixture.componentRef.setInput('languages', [ENGLISH]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const typeEpisode = root.querySelector<HTMLAnchorElement>(
      '[data-testid="card-firstAppearance-also"]',
    );
    const subcategory = root.querySelectorAll('[data-testid="card-subcategory-firstAppearance"]');
    expect(typeEpisode?.textContent?.trim()).toBe('Ep. 4 — Luffy’s Past');
    expect(typeEpisode?.getAttribute('href')).toBe('/content/episodes/e4');
    expect(subcategory).toHaveLength(1);
    expect(subcategory[0].textContent?.trim()).toBe('Ep. 4 — Luffy’s Past');
  });
});
