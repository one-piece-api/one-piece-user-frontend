import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { CHARACTER } from '../characters/character.model';
import { ENTITY } from './entities';
import { relativeListSection } from './entity-definition';
import { RelativeList } from './relative-list';

const SECTION = relativeListSection('relativesOf', 'relativeKinds');

describe('the relatives other characters name', () => {
  let fixture: ComponentFixture<RelativeList>;
  let root: HTMLElement;

  function show(body: Record<string, unknown>): void {
    fixture.componentRef.setInput('body', body);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: CHARACTER }],
    });
    fixture = TestBed.createComponent(RelativeList);
    fixture.componentRef.setInput('section', SECTION);
  });

  it('lists each one linked, with what it is to this character, worded after its gender', () => {
    show({
      relativesOf: [
        {
          relative: { id: 'c3', romaji: 'Monkey D. Garp', names: { en: 'Garp' }, gender: 'MALE' },
          kind: 'GRANDPARENT',
        },
        { relative: { id: 'c4', romaji: 'Dadan', gender: 'FEMALE' }, kind: 'GRANDPARENT' },
        { relative: { id: 'c5', romaji: 'Makino' }, kind: 'SPOUSE' },
      ],
    });

    const items = Array.from(root.querySelectorAll('[data-testid="relative-item"]'));
    expect(
      items.map((item) =>
        Array.from(item.querySelectorAll('span')).map((span) => span.textContent?.trim()),
      ),
    ).toEqual([
      ['Garp', 'Grandfather'],
      ['Dadan', 'Grandmother'],
      ['Makino', 'Spouse'],
    ]);
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/content/characters/c3');
    expect(root.querySelector('h2')?.textContent).toContain('Named as a relative by');
  });

  it('shows nothing where no one names this character', () => {
    show({ relativesOf: [] });

    expect(root.querySelector('[data-testid="relative-list"]')).toBeNull();
  });

  it('shows nothing where the content carries no such list', () => {
    show({});

    expect(root.querySelector('[data-testid="relative-list"]')).toBeNull();
  });
});
