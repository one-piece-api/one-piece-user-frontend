import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ENTITY } from '../entity/entities';
import type { EntityBody } from '../entity/entity-body';
import { EntityCard } from '../entity/entity-card';
import { DEVIL_FRUIT } from './devil-fruit.model';

const ITALIAN = { code: 'it', name: 'Italiano' };
const ENGLISH = { code: 'en', name: 'English' };

const TRANSLATIONS = {
  en: { name: 'Gum-Gum', description: 'd', advantages: 'p', disadvantages: 'c' },
  it: { name: 'Gomu', description: 'd', advantages: 'p', disadvantages: 'c' },
};

const GOMU: EntityBody = {
  romaji: 'Gomu Gomu no Mi',
  type: { id: 't1', romaji: 'Shizen-kei', names: { it: 'Rogia', en: 'Logia' } },
  translations: TRANSLATIONS,
};

describe('the card of a Devil Fruit', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: DEVIL_FRUIT }],
    });
  });

  function render(body: EntityBody): void {
    fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('languages', [ITALIAN, ENGLISH]);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function type(): HTMLElement | null {
    return root.querySelector('[data-testid="card-type"]');
  }

  it('shows its type as a chip leading to the type, named in the language shown', () => {
    render(GOMU);

    expect(type()?.textContent?.trim()).toBe('Logia');
    expect(type()?.getAttribute('href')).toBe('/content/devil-fruit-types/t1');
  });

  it('names the type in another language when the reader picks one', () => {
    render(GOMU);

    root.querySelector<HTMLButtonElement>('[role="tab"]')?.click();
    fixture.detectChanges();

    expect(type()?.textContent?.trim()).toBe('Rogia');
  });

  it('falls back on the romaji of a type with no name in the language', () => {
    render({ ...GOMU, type: { id: 't1', romaji: 'Shizen-kei', names: {} } });

    expect(type()?.textContent?.trim()).toBe('Shizen-kei');
  });

  it('says so when no type is chosen yet', () => {
    render({ ...GOMU, type: null });

    expect(type()?.getAttribute('href')).toBeNull();
    expect(type()?.textContent?.trim()).toBe('— no type chosen —');
  });

  describe('its image', () => {
    const IMAGE = { id: 'a1b2', url: '/api/content/images/a1b2' };

    function frame(): HTMLElement | null {
      return root.querySelector('app-entity-image-frame');
    }

    it('shows the image, named after the fruit in the language shown', () => {
      render({ ...GOMU, image: IMAGE });

      const image = frame()?.querySelector('img');
      expect(image?.getAttribute('src')).toBe(IMAGE.url);
      expect(image?.getAttribute('alt')).toBe('Gum-Gum');
    });

    it('stands a placeholder in for an image not there', () => {
      render({ ...GOMU, image: null });

      expect(frame()?.querySelector('img')).toBeNull();
      expect(frame()?.textContent?.trim()).toBe('Image of Gum-Gum');
    });

    it('stands the placeholder in for an image that cannot be loaded', () => {
      render({ ...GOMU, image: IMAGE });

      frame()?.querySelector('img')?.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      expect(frame()?.querySelector('img')).toBeNull();
      expect(frame()?.textContent?.trim()).toBe('Image of Gum-Gum');
    });

    it('names the placeholder by the romaji when the language has no name', () => {
      render({ ...GOMU, image: null, translations: {} });

      expect(frame()?.textContent?.trim()).toBe('Image of Gomu Gomu no Mi');
    });
  });
});
