import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { DEVIL_FRUIT } from '../devil-fruits/devil-fruit.model';
import { EVENT } from '../events/event.model';
import { ENTITY } from './entities';
import type { RelatedListSection } from './entity-definition';
import { EditorDialogs } from './entity-editor-dialog';
import { RelatedList } from './related-list';

const FRUIT = { id: 'f1', romaji: 'Gomu Gomu no Mi', names: { en: 'Gum-Gum Fruit' } };
const EVENTS = `/api/content/events?devilFruit=${FRUIT.id}&size=12`;

function eventRow(id: string, title: string, occursAt: unknown) {
  return {
    id,
    versionNumber: 1,
    status: 'PUBLISHED',
    author: { id: 'u1', username: 'nami', email: 'nami@onepiece.local' },
    updatedAt: '2026-10-01T08:00:00Z',
    onlineVersionNumber: 1,
    body: { names: { en: title }, occursAt },
    allowedActions: [],
    overrideActions: [],
  };
}

describe('the events of a fruit', () => {
  let fixture: ComponentFixture<RelatedList>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;
  const section = DEVIL_FRUIT.sections![0] as RelatedListSection;

  async function render(writable: boolean) {
    fixture = TestBed.createComponent(RelatedList);
    fixture.componentRef.setInput('section', section);
    fixture.componentRef.setInput('contentId', FRUIT.id);
    fixture.componentRef.setInput('content', FRUIT);
    fixture.componentRef.setInput('writable', writable);
    fixture.detectChanges();
    httpTesting.expectOne(EVENTS).flush({
      content: [
        eventRow('e1', 'Battle of Onigashima', {
          chapter: { id: 'c1000', number: 1000, names: { en: 'Straw Hat Luffy' } },
        }),
        eventRow('e2', 'Founding of the World Government', {
          worldDate: { yearFrom: 1498, yearTo: null, approximate: false },
        }),
      ],
      page: 0,
      size: 12,
      totalElements: 2,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ENTITY, useValue: DEVIL_FRUIT },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const texts = (testId: string) =>
    Array.from(root.querySelectorAll(`[data-testid="${testId}"]`)).map((element) =>
      element.textContent?.trim(),
    );

  it('lists the events the fruit takes part in, each with when it happens', async () => {
    await render(false);

    expect(texts('related-name')).toEqual([
      'Battle of Onigashima',
      'Founding of the World Government',
    ]);
    expect(texts('related-when')).toEqual(['Ch. 1000 — Straw Hat Luffy', '1498']);
    expect(
      root
        .querySelector('a[data-testid="related-item"], [data-testid="related-item"] a')
        ?.getAttribute('href'),
    ).toBe('/content/events/e1');
  });

  it('offers no new event to who cannot write', async () => {
    await render(false);

    expect(root.querySelector('[data-testid="related-create"]')).toBeNull();
  });

  it('opens a new event with the fruit among the participants', async () => {
    await render(true);
    const dialogs = TestBed.inject(EditorDialogs);

    root.querySelector<HTMLButtonElement>('[data-testid="related-create"]')!.click();

    expect(dialogs.request()).toEqual({ entity: EVENT, preset: { participants: [FRUIT] } });
  });
});
