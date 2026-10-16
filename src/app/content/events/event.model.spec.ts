import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { isSubgroup, NAV_GROUPS } from '../../shared/nav/nav-items';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ENTITIES, ENTITY, entityOf } from '../entity/entities';
import { draftOf, readinessChecks } from '../entity/entity-body';
import { EntityList } from '../entity/entity-list';
import { EVENT } from './event.model';

const EVENTS = '/api/content/events';
const AUTHOR = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };

@Component({ template: '' })
class Elsewhere {}

function eventRow(id: string, title: string, occursAt: unknown) {
  return {
    id,
    versionNumber: 1,
    status: 'DRAFT',
    author: AUTHOR,
    updatedAt: '2026-10-01T08:00:00Z',
    onlineVersionNumber: null,
    body: { names: { en: title }, occursAt },
    allowedActions: [],
    overrideActions: [],
  };
}

const ROWS = [
  eventRow('e1', 'Void Century', { worldDate: { yearFrom: 700, yearTo: 800, approximate: true } }),
  eventRow('e2', 'Reverie', { chapter: { id: 'c908', number: 908, names: { en: 'Reverie' } } }),
  eventRow('e3', 'Untimed', null),
];

describe('the Event entity', () => {
  it('is registered last, known by its id and written in a dialog', () => {
    expect(ENTITIES.at(-1)).toBe(EVENT);
    expect(entityOf('EVENT')).toBe(EVENT);
    expect(EVENT.naturalKey).toBeUndefined();
    expect(EVENT.editor).toBe('dialog');
  });

  it('closes the story subgroup of the menu', () => {
    const story = NAV_GROUPS.flatMap(({ items }) => items)
      .filter(isSubgroup)
      .find(({ labelKey }) => labelKey === 'shell.nav.story');

    expect(story?.items.at(-1)?.route).toBe('/content/events');
  });

  it('asks review for when it happens and the title, not for the extras', () => {
    const asked = readinessChecks(EVENT, draftOf(EVENT, null, ['it']), ['it']).map(
      ({ field }) => field,
    );

    expect(asked).toEqual(['occursAt', 'title']);
  });
});

describe('the list of events', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: EVENT },
        provideRouter(
          [
            { path: 'content/events', component: EntityList },
            { path: 'content/events/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/content/events');
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read'],
    });
    httpTesting.expectOne(`${EVENTS}/summary`).flush({ total: 3, mine: 0, statuses: ['DRAFT'] });
    httpTesting.expectOne(`${EVENTS}/authors`).flush([]);
    // No sort asked for: the backend's default is the order of the world.
    httpTesting.expectOne(`${EVENTS}?page=0`).flush(page(ROWS));
    await settle();
    root = harness.routeNativeElement as HTMLElement;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  function page(content: unknown[]) {
    return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
  }

  it('shows when each event happens, a dash where it is not written yet', () => {
    const cells = Array.from(root.querySelectorAll('[data-testid="time-cell"]'));

    expect(cells.map((cell) => cell.textContent?.trim())).toEqual([
      'c. 700–800',
      'Ch. 908 — Reverie',
      '—',
    ]);
  });

  it('is shown in the order of the world, and flips it from the column header', async () => {
    const header = Array.from(root.querySelectorAll('app-sort-header button')).find((button) =>
      button.textContent?.includes('When it happens'),
    ) as HTMLButtonElement;
    expect(header.textContent).toContain('↑');

    header.click();
    await settle();
    httpTesting.expectOne(`${EVENTS}?page=0&sort=occursAt%2Cdesc`).flush(page([...ROWS].reverse()));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/content/events?sort=occursAt,desc');
  });
});
