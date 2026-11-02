import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { BOUNTY } from '../bounties/bounty.model';
import { CHARACTER } from '../characters/character.model';
import type { EntityDefinition } from './entity-definition';
import { revealsDraftOf, truthOf, type RevealsDraft } from './entity-reveals';
import { RevealsPanel } from './reveals-panel';

const LANGUAGES = ['it', 'en'];
const CH_1 = { id: 'c1', number: 1 };
const CH_200 = { id: 'c200', number: 200 };

describe('the reveals panel', () => {
  let fixture: ComponentFixture<RevealsPanel>;
  let root: HTMLElement;
  let emitted: RevealsDraft[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  function show(entity: EntityDefinition, body: Record<string, unknown>): void {
    fixture = TestBed.createComponent(RevealsPanel);
    fixture.componentRef.setInput('entity', entity);
    fixture.componentRef.setInput('reveals', revealsDraftOf(entity, body, LANGUAGES));
    fixture.componentRef.setInput('truth', truthOf(entity, body, LANGUAGES));
    fixture.componentRef.setInput('firstAppearance', { chapter: CH_1 });
    fixture.componentRef.setInput('languages', LANGUAGES);
    fixture.componentRef.setInput('defaultLanguage', 'en');
    fixture.componentRef.setInput('editable', true);
    emitted = [];
    fixture.componentInstance.changed.subscribe((draft) => emitted.push(draft));
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function click(id: string): void {
    root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click();
    fixture.detectChanges();
  }

  it('writes the identity of a Character as one choice of three values', () => {
    show(CHARACTER, {
      romaji: 'Bentham',
      japaneseName: 'ベンサム',
      translations: { it: { name: 'Bon Clay' }, en: { name: 'Bon Clay' } },
      initialKnowledge: {
        romaji: 'Mr. 2 Bon Kurei',
        japaneseName: 'ボン・クレー',
        translations: { it: { name: 'Mr. 2' }, en: { name: 'Mr. 2' } },
      },
      reveals: [
        {
          revealedAt: { chapter: CH_200 },
          titles: { it: 'Il vero nome', en: 'The real name' },
          fields: ['IDENTITY'],
        },
      ],
    });

    click('reveal-start');
    const initial = root.querySelector('[data-testid="reveal-initial"]')!;
    expect(initial.textContent).toContain('Identity');
    const inputs = Array.from(initial.querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.map((input) => input.value)).toEqual([
      'Mr. 2 Bon Kurei',
      'ボン・クレー',
      'Mr. 2',
    ]);

    inputs[1].value = 'ボン';
    inputs[1].dispatchEvent(new Event('input'));

    expect(emitted.at(-1)!.initial['japaneseName']).toBe('ボン');
  });

  it('keeps two quick edits made before the editor passes the reveals back in', () => {
    show(BOUNTY, {
      inactive: true,
      reveals: [{ revealedAt: { chapter: CH_200 }, titles: {}, fields: [] }],
    });
    click('reveal-node');

    // The editor never passes the new reveals back in: both edits must still build on each other.
    const title = root.querySelector<HTMLInputElement>('[data-testid="reveal-title"]')!;
    title.value = 'Withdrawn';
    title.dispatchEvent(new Event('input'));
    const addField = root.querySelector<HTMLSelectElement>('[data-testid="add-field"]')!;
    addField.value = 'INACTIVE';
    addField.dispatchEvent(new Event('change'));

    const last = emitted.at(-1)!.reveals[0];
    expect(last.titles['en']).toBe('Withdrawn');
    expect(last.groups).toEqual(['INACTIVE']);
  });

  it('hands back only the current values changed', () => {
    show(CHARACTER, {
      romaji: 'Bentham',
      status: 'ALIVE',
      translations: { it: { name: 'Bon Clay' }, en: { name: 'Bon Clay' } },
      initialKnowledge: { translations: { it: { name: 'Mr. 2' }, en: { name: 'Mr. 2' } } },
      reveals: [
        { revealedAt: { chapter: CH_200 }, titles: { en: 'The name' }, fields: ['IDENTITY'] },
      ],
    });
    const truths: object[] = [];
    fixture.componentInstance.truthChanged.subscribe((truth) => truths.push(truth));
    click('reveal-node');
    if (!root.querySelector('[data-testid="reveal-after"]')) {
      click('reveal-row-toggle');
    }

    const after = root.querySelector('[data-testid="reveal-after"]')!;
    const name = after.querySelector<HTMLInputElement>('input[id$="-name-en"]')!;
    name.value = 'Bon Kurei';
    name.dispatchEvent(new Event('input'));

    expect(truths).toEqual([{ translations: { en: { name: 'Bon Kurei' } } }]);
  });

  it('writes whether a Bounty is inactive as a yes or no', () => {
    show(BOUNTY, {
      inactive: true,
      initialKnowledge: { inactive: false },
      reveals: [
        {
          revealedAt: { chapter: CH_200 },
          titles: { it: 'Ritirata', en: 'Withdrawn' },
          fields: ['INACTIVE'],
        },
      ],
    });

    click('reveal-start');
    const box = root.querySelector<HTMLInputElement>(
      '[data-testid="reveal-initial"] input[type="checkbox"]',
    )!;
    expect(box.checked).toBe(false);

    box.checked = true;
    box.dispatchEvent(new Event('change'));

    expect(emitted.at(-1)!.initial['inactive']).toBe(true);
  });
});
