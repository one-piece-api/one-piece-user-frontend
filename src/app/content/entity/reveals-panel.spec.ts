import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { DEVIL_FRUIT } from '../devil-fruits/devil-fruit.model';
import { draftOf } from './entity-body';
import { revealsOfDraft, type Belief, type RevealsDraft } from './entity-reveals';
import { RevealsPanel } from './reveals-panel';

const LANGUAGES = ['it', 'en'];
const chapter = (number: number) => ({ id: `chapter-${number}`, number, names: {} });

/** The Gomu Gomu of the backend's fixture, cut to the description (T13). */
const FRUIT = {
  romaji: 'Hito Hito no Mi, Model: Nika',
  firstAppearance: { chapter: chapter(1) },
  translations: {
    it: { name: 'Frutto Homo Homo', description: 'Il frutto del dio del sole' },
    en: { name: 'Human-Human Fruit', description: 'The fruit of the sun god' },
  },
  initialKnowledge: {
    translations: {
      it: { description: 'Gomma, niente di più' },
      en: { description: 'Rubber, nothing more' },
    },
  },
  reveals: [
    {
      revealedAt: { chapter: chapter(100) },
      fields: ['description'],
      titles: { it: 'Un corpo di gomma', en: 'A body of rubber' },
      translations: {
        it: { description: 'Un corpo di gomma' },
        en: { description: 'A body of rubber' },
      },
    },
    {
      revealedAt: { chapter: chapter(1044) },
      fields: ['description', 'disadvantages'],
      titles: { it: 'Il frutto è Nika', en: 'The fruit is Nika' },
    },
  ],
};

describe('the Reveals tab', () => {
  let fixture: ComponentFixture<RevealsPanel>;
  let root: HTMLElement;
  let changes: RevealsDraft[];

  /** `refusals` is given the reveals drawn, whose keys name the nodes. */
  function render(
    editable: boolean,
    refusals: (reveals: RevealsDraft) => Record<string, Record<string, string>> = () => ({}),
  ) {
    const truth = draftOf(DEVIL_FRUIT, FRUIT as never, LANGUAGES);
    const reveals = revealsOfDraft(truth);
    fixture = TestBed.createComponent(RevealsPanel);
    fixture.componentRef.setInput('entity', DEVIL_FRUIT);
    fixture.componentRef.setInput('reveals', reveals);
    fixture.componentRef.setInput('truth', truth as Belief);
    fixture.componentRef.setInput('firstAppearance', truth['firstAppearance']);
    fixture.componentRef.setInput('languages', LANGUAGES);
    fixture.componentRef.setInput('editable', editable);
    fixture.componentRef.setInput('refusals', refusals(reveals));
    changes = [];
    fixture.componentInstance.changed.subscribe((change) => {
      changes.push(change);
      fixture.componentRef.setInput('reveals', change);
    });
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  const nodes = () =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testid="reveal-node"]'));
  const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();
  const open = (index: number) => {
    nodes()[index].click();
    fixture.detectChanges();
  };
  const rows = () => Array.from(root.querySelectorAll('[data-testid="reveal-row"]'));
  const toggles = () =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testid="reveal-row-toggle"]'));
  const expand = (index: number) => {
    toggles()[index].click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('lists first appearance, then each reveal in chapter order', () => {
    render(false);

    const words = (node: Element) =>
      Array.from(node.querySelectorAll('span')).map(text).filter(Boolean).join(' ');
    expect(words(root.querySelector('[data-testid="reveal-start"]')!)).toBe(
      'Ch. 1 First appearance',
    );
    expect(nodes().map(words)).toEqual([
      'Ch. 100 A body of rubber 1 field',
      'Ch. 1044 The fruit is Nika 2 fields',
    ]);
  });

  it('reads a reveal forward: what the reader knew, then what they learn', () => {
    render(false);
    open(1);
    expand(0);

    const [description, disadvantages] = rows();
    expect(text(description.querySelector('[data-testid="reveal-before"]'))).toContain(
      'A body of rubber',
    );
    expect(text(description.querySelector('[data-testid="reveal-after"]'))).toContain(
      'The fruit of the sun god',
    );
    expect(text(description)).toContain('This is the current truth');
    // Unknown before its first reveal: no initial value.
    expect(text(disadvantages)).toContain('Not revealed yet');
  });

  it('shows the texts in one language at a time, switched by the user', () => {
    render(false);
    open(1);
    expand(0);
    expect(text(rows()[0])).not.toContain('Il frutto del dio del sole');

    root.querySelectorAll<HTMLButtonElement>('[data-testid="reveal-language"]')[0].click();
    fixture.detectChanges();

    expect(text(rows()[0])).toContain('Il frutto del dio del sole');
    expect(text(rows()[0])).not.toContain('The fruit of the sun god');
  });

  it('writes the value learned, and the truth where the last mention reaches it', () => {
    render(true);
    const truths: Belief[] = [];
    fixture.componentInstance.truthChanged.subscribe((truth) => truths.push(truth));
    open(0);
    expand(0);
    expect(rows()[0].querySelectorAll('textarea')).toHaveLength(1);

    open(1);
    expand(0);
    const english = rows()[0].querySelector('textarea')!;
    expect(english.value).toBe('The fruit of the sun god');
    english.value = 'The fruit of Nika';
    english.dispatchEvent(new Event('input'));

    expect(truths.at(-1)?.translations['en']['description']).toBe('The fruit of Nika');
    expect(text(rows()[0])).toContain('it changes the main fields too');
  });

  it('asks a value of the earlier reveal once a later one names the same field', () => {
    render(true);
    open(0);
    const select = root.querySelector<HTMLSelectElement>('[data-testid="add-field"]')!;
    select.value = 'disadvantages';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(changes.at(-1)?.reveals.find(({ key }) => key)?.fields).toEqual([
      'description',
      'disadvantages',
    ]);
    // The field added opens; at ch. 100 it is no longer the last mention: a value to write.
    expect(rows()[1].querySelectorAll('textarea')).toHaveLength(1);
  });

  it('opens the fields closed, one at a time, each summed up as before → after', () => {
    render(false);
    open(1);
    const expanded = () => toggles().map((toggle) => toggle.getAttribute('aria-expanded'));

    expect(expanded()).toEqual(['false', 'false']);
    expect(text(toggles()[0])).toContain('A body of rubber→The fruit of the sun god');
    expand(0);
    expand(1);

    expect(expanded()).toEqual(['false', 'true']);
  });

  it('shows the first appearance as the start, with nothing to open', () => {
    render(true);

    const start = root.querySelector('[data-testid="reveal-start"]')!;
    expect(start.tagName).not.toBe('BUTTON');
    expect(start.querySelector('button')).toBeNull();
  });

  it('adds a reveal and opens it', () => {
    render(true);
    root.querySelector<HTMLButtonElement>('[data-testid="add-reveal"]')!.click();
    fixture.detectChanges();

    expect(changes.at(-1)?.reveals).toHaveLength(3);
    expect(text(root.querySelector('[data-testid="reveal-detail"] h3'))).toContain('New reveal');
  });

  it('marks a refused reveal and sums up every problem', () => {
    render(true, (reveals) => ({ [reveals.reveals[1].key]: { 'title.en': 'Text too long' } }));

    expect(text(root.querySelector('[data-testid="reveals-summary"]'))).toContain(
      'Ch. 1044 — The fruit is Nika · title EN · Text too long',
    );
    expect(text(nodes()[1])).toContain('!');
  });
});
