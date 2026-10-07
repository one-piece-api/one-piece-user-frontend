import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import type { EntityReference } from './entity-reference';
import { RelationPicker } from './relation-picker';

const SOURCE = '/api/content/devil-fruit-types';
const LINKABLE = `${SOURCE}/linkable`;

const LOGIA: EntityReference = {
  id: 't1',
  romaji: 'Shizen-kei',
  names: { it: 'Rogia', en: 'Logia' },
};
const ZOAN: EntityReference = { id: 't2', romaji: 'Dobutsu-kei', names: { it: 'Zoo', en: 'Zoan' } };

function page(content: EntityReference[]) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
}

describe('the relation picker', () => {
  let httpTesting: HttpTestingController;
  let fixture: ComponentFixture<RelationPicker>;
  let root: HTMLElement;
  let picks: (EntityReference | null)[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function render(value: EntityReference | null = null): void {
    fixture = TestBed.createComponent(RelationPicker);
    fixture.componentRef.setInput('inputId', 'draft-type');
    fixture.componentRef.setInput('source', SOURCE);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('placeholder', 'pick a type');
    picks = [];
    fixture.componentInstance.picked.subscribe((reference) => picks.push(reference));
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function box(): HTMLInputElement {
    return root.querySelector<HTMLInputElement>('#draft-type')!;
  }

  function choices(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="relation-choice"]')).map(
      (choice) => choice.textContent?.replace('✓', '').trim() ?? '',
    );
  }

  /** Opens the list and answers what it asks for. */
  async function openWith(found: EntityReference[], query = 'size=20'): Promise<void> {
    box().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    httpTesting.expectOne(`${LINKABLE}?${query}`).flush(page(found));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function press(key: string): void {
    box().dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    fixture.detectChanges();
  }

  it('shows the content chosen by its name, without asking for anything', () => {
    render(LOGIA);

    expect(box().value).toBe('Logia');
    expect(root.querySelector('[data-testid="relation-choices"]')).toBeNull();
  });

  it('is empty, with its placeholder, while nothing is chosen', () => {
    render();

    expect(box().value).toBe('');
    expect(box().placeholder).toBe('pick a type');
    expect(root.querySelector('[data-testid="relation-clear"]')).toBeNull();
  });

  it('clears the choice from its button', () => {
    render(LOGIA);

    root.querySelector<HTMLButtonElement>('[data-testid="relation-clear"]')!.click();

    expect(picks).toEqual([null]);
  });

  it('asks the section for what can be linked when it opens, and lists the choices', async () => {
    render(LOGIA);

    await openWith([LOGIA, ZOAN]);

    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(choices()).toEqual(['Logia', 'Zoan']);
    const selected = Array.from(root.querySelectorAll('[role="option"]')).map((option) =>
      option.getAttribute('aria-selected'),
    );
    expect(selected).toEqual(['true', 'false']);
  });

  it('chooses a content by a click, then closes', async () => {
    render();
    await openWith([LOGIA, ZOAN]);

    root.querySelectorAll<HTMLElement>('[data-testid="relation-choice"]')[1].click();
    fixture.detectChanges();

    expect(picks).toEqual([ZOAN]);
    expect(root.querySelector('[data-testid="relation-choices"]')).toBeNull();
  });

  it('searches what is typed, a moment after the last keystroke', async () => {
    render();
    await openWith([LOGIA, ZOAN]);

    box().value = 'zo';
    box().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    httpTesting.expectNone(`${LINKABLE}?q=zo&size=20`);
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    httpTesting.expectOne(`${LINKABLE}?q=zo&size=20`).flush(page([ZOAN]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(box().value).toBe('zo');
    expect(choices()).toEqual(['Zoan']);
  });

  it('is driven from the keyboard: the arrows move, Enter chooses, Escape closes', async () => {
    render();
    await openWith([LOGIA, ZOAN]);

    press('ArrowDown');
    press('ArrowDown');
    expect(box().getAttribute('aria-activedescendant')).toBe('draft-type-option-1');
    press('ArrowUp');
    press('Enter');

    expect(picks).toEqual([LOGIA]);
    press('Escape');
    expect(root.querySelector('[data-testid="relation-choices"]')).toBeNull();
  });

  it('closes with Escape without choosing anything', async () => {
    render(LOGIA);
    await openWith([LOGIA]);

    press('Escape');

    expect(picks).toEqual([]);
    expect(box().value).toBe('Logia');
  });

  it('says so when nothing can be linked', async () => {
    render();

    await openWith([]);

    expect(root.querySelector('[data-testid="relation-status"]')?.textContent?.trim()).toBe(
      'No results',
    );
  });

  it('says so when the search fails', async () => {
    render();

    box().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    httpTesting
      .expectOne(`${LINKABLE}?size=20`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="relation-status"]')?.textContent?.trim()).toBe(
      'Search failed, try again',
    );
  });

  it('marks the box when the backend refused the choice', () => {
    render(LOGIA);
    fixture.componentRef.setInput('invalid', true);
    fixture.detectChanges();

    expect(box().getAttribute('aria-invalid')).toBe('true');
  });
});
