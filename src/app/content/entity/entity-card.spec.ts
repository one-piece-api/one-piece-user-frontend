import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { NOTE, NOTE_WITH_PARTICIPANTS, NOTE_WITHOUT_KEY } from '../../testing/note-entity';
import { DEVIL_FRUIT } from '../devil-fruits/devil-fruit.model';
import { ENTITY } from './entities';
import type { EntityDefinition } from './entity-definition';
import { EntityCard } from './entity-card';

/** The card of any entity, run with entities that exist only in the specs. */
describe('the card of any entity', () => {
  function render(
    entity: EntityDefinition,
    body: Record<string, unknown>,
    unrevealed: string[] = [],
  ): HTMLElement {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: entity }],
    });
    const fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', { translations: {}, ...body });
    fixture.componentRef.setInput('languages', [{ code: 'en', name: 'English' }]);
    fixture.componentRef.setInput('unrevealed', unrevealed);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says "Not revealed yet" where the reader of the preview does not know a field', () => {
    const card = render(
      DEVIL_FRUIT,
      {
        romaji: null,
        type: null,
        translations: { en: { name: null, description: null, disadvantages: null } },
      },
      ['romaji', 'type', 'name', 'disadvantages'],
    );
    const text = (testId: string) =>
      card.querySelector(`[data-testid="card-${testId}"]`)?.textContent?.trim();

    expect(text('name')).toBe('Not revealed yet');
    expect(
      card.querySelector('[data-testid="card-name"]')?.nextElementSibling?.textContent?.trim(),
    ).toBe('Not revealed yet');
    expect(text('type')).toBe('Not revealed yet');
    expect(text('disadvantages')).toBe('Not revealed yet');
    // Known to the reader, only not written: the card says so as usual.
    expect(text('description')).not.toBe('Not revealed yet');
  });

  it('shows the natural key under the name, or a dash while it has none', () => {
    const card = render(NOTE, { romaji: null });

    expect(
      card.querySelector('[data-testid="card-name"]')?.nextElementSibling?.textContent?.trim(),
    ).toBe('—');
  });

  it('shows nothing under the name of an entity told apart by its id alone', () => {
    const card = render(NOTE_WITHOUT_KEY, {
      translations: { en: { name: 'Reverie', body: null } },
    });

    expect(card.querySelector('[data-testid="card-name"]')?.textContent?.trim()).toBe('Reverie');
    expect(card.querySelector('[data-testid="card-name"]')?.nextElementSibling).toBeNull();
  });

  it('shows every content of a list, each a link to its page', () => {
    const card = render(NOTE_WITH_PARTICIPANTS, {
      participants: {
        devilFruits: [
          { id: 'f1', romaji: 'Gomu Gomu no Mi', names: {} },
          { id: 'f2', romaji: 'Mera Mera no Mi', names: {} },
        ],
      },
    });

    const links = Array.from(
      card.querySelectorAll<HTMLAnchorElement>('[data-testid="card-participants"] a'),
    );
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Gomu Gomu no Mi',
      'Mera Mera no Mi',
    ]);
    expect(links[0].getAttribute('href')).toBe('/content/devil-fruits/f1');
  });

  it('says so where the list has no content', () => {
    const card = render(NOTE_WITH_PARTICIPANTS, { participants: { devilFruits: [] } });

    expect(card.querySelector('[data-testid="card-participants"] a')).toBeNull();
    expect(card.textContent).toContain('No Devil Fruits');
  });
});
