import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { GIANT, HUMAN, NAVY, PEOPLE } from '../../testing/part-list-entity';
import { ENTITY } from './entities';
import type { EntityBody } from './entity-body';
import { EntityCard } from './entity-card';

const LANGUAGES = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
];

/** Epithets written in Italian only for the second one. */
const NAMI: EntityBody = {
  romaji: 'Nami',
  birthday: '--07-03',
  species: [HUMAN, GIANT],
  epithets: [{ text: { it: 'Gatta ladra', en: 'Cat Burglar' } }, { text: { it: 'Navigatrice' } }],
  aliases: ['Miss Nami'],
  memberships: [{ affiliation: NAVY, role: { en: 'Spy' }, former: false }],
  translations: { it: { name: 'Nami' }, en: { name: 'Nami' } },
};

describe('the card of an entity with lists of parts and a day of the year', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: PEOPLE }],
    });
  });

  function render(body: EntityBody): void {
    fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('languages', LANGUAGES);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function entries(list: string): string[] {
    return [
      ...root.querySelectorAll(`[data-testid="card-${list}"] [data-testid="card-part-entry"]`),
    ].map((entry) => entry.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  it('names the day without a year, in the interface language', () => {
    render(NAMI);
    expect(root.querySelector('[data-testid="card-birthday"]')?.textContent?.trim()).toBe('July 3');

    TestBed.inject(TranslocoService).setActiveLang('it');
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="card-birthday"]')?.textContent?.trim()).toBe(
      '3 luglio',
    );
  });

  it('links each content of a list to its card, in the order of the list', () => {
    render(NAMI);

    const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-testid="card-species"] a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/content/species/s1',
      '/content/species/s2',
    ]);
    expect(entries('species')).toHaveLength(2);
  });

  it('shows a localized part in the language shown, and says where it is not written', () => {
    render(NAMI);

    expect(entries('epithets')).toEqual(['Cat Burglar', '— not written in EN —']);
    expect(entries('aliases')).toEqual(['Miss Nami']);
  });

  it('joins the parts of an entry, leaving out a no and an empty part', () => {
    render(NAMI);

    expect(entries('memberships')).toEqual([expect.stringMatching(/ · Spy$/)]);
  });

  it('shows nothing for an empty list or a day never picked', () => {
    render({ ...NAMI, birthday: null, species: [], aliases: [] });

    expect(root.querySelector('[data-testid="card-birthday"]')).toBeNull();
    expect(root.querySelector('[data-testid="card-species"]')).toBeNull();
    expect(root.querySelector('[data-testid="card-aliases"]')).toBeNull();
  });
});
