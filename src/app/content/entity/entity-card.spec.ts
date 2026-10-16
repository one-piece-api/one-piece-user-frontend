import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { NOTE, NOTE_WITHOUT_KEY } from '../../testing/note-entity';
import { ENTITY } from './entities';
import type { EntityDefinition } from './entity-definition';
import { EntityCard } from './entity-card';

/** The card of any entity, run with entities that exist only in the specs. */
describe('the card of any entity', () => {
  function render(entity: EntityDefinition, body: Record<string, unknown>): HTMLElement {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: entity }],
    });
    const fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', { translations: {}, ...body });
    fixture.componentRef.setInput('languages', [{ code: 'en', name: 'English' }]);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

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
});
