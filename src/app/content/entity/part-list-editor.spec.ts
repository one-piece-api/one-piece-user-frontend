import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { CREW, HUMAN, NAVY, PEOPLE } from '../../testing/part-list-entity';
import type { PartListField } from './entity-definition';
import type { PartEntryDraft } from './entity-part-list';
import { PartListEditor, type PartListChange } from './part-list-editor';
import { RelationPicker } from './relation-picker';

function list(key: string): PartListField {
  const field = PEOPLE.fields.find((candidate) => candidate.key === key);
  if (field?.kind !== 'partList') {
    throw new Error(`no list ${key}`);
  }
  return field;
}

function entry(key: string, values: Record<string, unknown>): PartEntryDraft {
  return { key, values };
}

describe('the editor of a list of parts', () => {
  let fixture: ComponentFixture<PartListEditor>;
  let root: HTMLElement;
  let changes: PartListChange[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function render(
    key: string,
    entries: PartEntryDraft[],
    errors: Record<string, string> = {},
  ): void {
    fixture = TestBed.createComponent(PartListEditor);
    fixture.componentRef.setInput('field', list(key));
    fixture.componentRef.setInput('i18n', PEOPLE.i18n);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('languages', ['it', 'en']);
    fixture.componentRef.setInput('errors', errors);
    changes = [];
    fixture.componentInstance.changed.subscribe((change) => changes.push(change));
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function all(testId: string): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
  }

  function box<T extends HTMLElement = HTMLInputElement>(id: string): T {
    return root.querySelector<T>(`#${id}`)!;
  }

  function type(id: string, text: string): void {
    const input = box(id);
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  function valuesOf(change: PartListChange): Record<string, unknown>[] {
    return change.entries.map(({ values }) => values);
  }

  it('draws one box per language for a localized part, in the catalog order', () => {
    render('epithets', [entry('a', { text: { it: 'Gatta ladra' } })]);

    expect(box('draft-epithets-0-text-it').value).toBe('Gatta ladra');
    expect(box('draft-epithets-0-text-en').value).toBe('');
    expect(box('draft-epithets-0-text-en').getAttribute('lang')).toBe('en');
    expect(box('draft-epithets-0-text-it').getAttribute('maxlength')).toBe('100');
  });

  it('writes a text in one language, keeping the others, and says which box was written', () => {
    render('epithets', [entry('a', { text: { it: 'Gatta ladra' } })]);

    type('draft-epithets-0-text-en', 'Cat Burglar');

    expect(valuesOf(changes[0])).toEqual([{ text: { it: 'Gatta ladra', en: 'Cat Burglar' } }]);
    expect(changes[0].touched).toBe('0.text.en');
    expect(changes[0].entries[0].key).toBe('a');
  });

  it('adds an empty entry at the end, with a key of its own', () => {
    render('aliases', [entry('a', { alias: 'Sogeking' })]);

    all('part-add')[0].click();

    expect(valuesOf(changes[0])).toEqual([{ alias: 'Sogeking' }, {}]);
    expect(changes[0].entries[1].key).not.toBe('a');
    expect(changes[0].touched).toBeNull();
  });

  it('removes an entry and moves one up or down, never past the ends', () => {
    const entries = [entry('a', { alias: 'Sogeking' }), entry('b', { alias: 'Mr. Prince' })];
    render('aliases', entries);

    const [firstUp, secondUp] = all('part-up') as HTMLButtonElement[];
    const [firstDown, secondDown] = all('part-down') as HTMLButtonElement[];
    expect([firstUp.disabled, secondUp.disabled]).toEqual([true, false]);
    expect([firstDown.disabled, secondDown.disabled]).toEqual([false, true]);

    secondUp.click();
    firstDown.click();
    all('part-remove')[0].click();

    expect(changes.map((change) => change.entries.map(({ key }) => key))).toEqual([
      ['b', 'a'],
      ['b', 'a'],
      ['b'],
    ]);
    expect(changes.every(({ touched }) => touched === null)).toBe(true);
  });

  it('stops adding once the list is full, and says so', () => {
    render('epithets', [entry('a', {}), entry('b', {}), entry('c', {})]);

    const add = all('part-add')[0] as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(all('part-full')[0].textContent).toContain('3');

    add.click();
    expect(changes).toEqual([]);
  });

  it('says the list is empty when it has no entry', () => {
    render('aliases', []);

    expect(all('part-entry')).toHaveLength(0);
    expect(all('part-full')).toHaveLength(0);
  });

  it('draws each part of an entry as its kind: content, text, choice, flag', () => {
    render('memberships', [
      entry('a', { affiliation: NAVY, role: { en: 'Spy' }, rank: 'CAPTAIN', former: true }),
    ]);

    expect(box('draft-memberships-0-affiliation')).not.toBeNull();
    expect(box('draft-memberships-0-role-en').value).toBe('Spy');
    expect(box<HTMLSelectElement>('draft-memberships-0-rank').value).toBe('CAPTAIN');
    expect(box('draft-memberships-0-former').checked).toBe(true);

    const rank = box<HTMLSelectElement>('draft-memberships-0-rank');
    rank.value = 'ADMIRAL';
    rank.dispatchEvent(new Event('change'));
    const former = box('draft-memberships-0-former');
    former.checked = false;
    former.dispatchEvent(new Event('change'));

    expect(changes.map(({ touched }) => touched)).toEqual(['0.rank', '0.former']);
    expect(changes[0].entries[0].values['rank']).toBe('ADMIRAL');
    expect(changes[1].entries[0].values['former']).toBe(false);
  });

  describe('a part that waits for the content chosen in another', () => {
    const picked = (reference: unknown) =>
      (
        fixture.debugElement.query(By.directive(RelationPicker)).componentInstance as RelationPicker
      ).picked.emit(reference as never);

    it('draws it only once the content chosen has the value asked for', () => {
      render('memberships', [entry('a', { affiliation: NAVY }), entry('b', { affiliation: CREW })]);

      expect(box('draft-memberships-0-rank')).not.toBeNull();
      expect(box('draft-memberships-1-rank')).toBeNull();
    });

    it('does not draw it before any content is chosen', () => {
      render('memberships', [entry('a', {})]);

      expect(box('draft-memberships-0-rank')).toBeNull();
    });

    it('keeps drawing a value that is already there, so it can be removed', () => {
      render('memberships', [entry('a', { affiliation: CREW, rank: 'CAPTAIN' })]);

      expect(box<HTMLSelectElement>('draft-memberships-0-rank').value).toBe('CAPTAIN');
    });

    it('clears it when another content is chosen', () => {
      render('memberships', [entry('a', { affiliation: NAVY, rank: 'ADMIRAL' })]);

      picked(CREW);

      expect(valuesOf(changes[0])).toEqual([{ affiliation: CREW, rank: '' }]);
    });
  });

  it('puts a content picked in the entry', () => {
    render('species', [entry('a', {})]);

    const picker = fixture.debugElement.query(By.directive(RelationPicker));
    (picker.componentInstance as RelationPicker).picked.emit(HUMAN);

    expect(valuesOf(changes[0])).toEqual([{ species: HUMAN }]);
    expect(changes[0].touched).toBe('0.species');
  });

  it('shows a refusal under the box it is about, or under the entry', () => {
    render('epithets', [entry('a', { text: { it: 'x' } }), entry('b', {})], {
      '0.text.en': 'missing in English',
      '1': 'already in this list',
    });

    expect(box('draft-epithets-0-text-en').getAttribute('aria-invalid')).toBe('true');
    expect(box('draft-epithets-0-text-it').getAttribute('aria-invalid')).toBeNull();
    const [first, second] = all('part-entry');
    expect(first.textContent).toContain('missing in English');
    expect(second.textContent).toContain('already in this list');
  });
});
