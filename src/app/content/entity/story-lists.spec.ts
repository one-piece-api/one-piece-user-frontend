import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ARC } from '../arcs/arc.model';
import { CHAPTER } from '../chapters/chapter.model';
import { ENTITY } from './entities';
import { isNumbered } from './entity-definition';
import { EntityList } from './entity-list';
import { RelatedList } from './related-list';

const CHAPTERS = '/api/content/chapters';
const AUTHOR = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const ARC_ID = 'a1';
const VOLUME_ID = 'v1';
const BY_NUMBER = 'sort=number%2Casc';

@Component({ template: '' })
class Elsewhere {}

function chapterRow(id: string, number: number, title: string) {
  return {
    id,
    versionNumber: 1,
    status: 'PUBLISHED',
    author: AUTHOR,
    updatedAt: '2026-10-01T08:00:00Z',
    onlineVersionNumber: 1,
    body: {
      number,
      names: { en: title },
      arc: { id: ARC_ID, number: 1, names: { en: 'Romance Dawn' } },
      volume: { id: VOLUME_ID, number: 1, names: { en: 'Romance Dawn' } },
    },
    allowedActions: [],
    overrideActions: [],
  };
}

function page(content: unknown[]) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
}

const ROWS = [chapterRow('c1', 1, 'Romance Dawn'), chapterRow('c2', 2, 'They Call Him Luffy')];

describe('the entity definitions', () => {
  it('are numbered when their natural key is a number', () => {
    expect(isNumbered(CHAPTER)).toBe(true);
    expect(isNumbered({ ...CHAPTER, naturalKey: 'title' })).toBe(false);
  });
});

describe('the list of a numbered entity with two relations', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: CHAPTER },
        provideRouter(
          [
            { path: 'content/chapters', component: EntityList },
            { path: 'content/chapters/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
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

  /** Opens the list at `url`, answering the list at `listQuery` with `rows` and the rest. */
  async function open(url: string, listQuery: string, rows: unknown[]): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read'],
    });
    httpTesting
      .expectOne(`${CHAPTERS}/summary`)
      .flush({ total: Math.max(rows.length, 1), mine: 0, statuses: ['PUBLISHED'] });
    httpTesting.expectOne(`${CHAPTERS}/authors`).flush([]);
    httpTesting.expectOne(`${CHAPTERS}?${listQuery}`).flush(page(rows));
    await settle();
    root = harness.routeNativeElement as HTMLElement;
  }

  it('lists in story order by default and shows the number in its own column', async () => {
    await open('/content/chapters', `page=0&${BY_NUMBER}`, ROWS);

    const cells = Array.from(root.querySelectorAll('[data-testid="number-cell"]'));
    expect(cells.map((cell) => cell.textContent?.trim())).toEqual(['1', '2']);
    const firstRow = root.querySelector('[data-testid="content-row"]')!;
    expect(firstRow.querySelector('a')?.textContent).toContain('Romance Dawn');
    expect(firstRow.className).toContain('sm:grid-cols-[3.5rem_');
  });

  it('shows a column and a link per relation, and a search hint that mentions the number', async () => {
    await open('/content/chapters', `page=0&${BY_NUMBER}`, ROWS);

    const cells = root.querySelectorAll('[data-testid="relation-cell"]');
    expect(cells).toHaveLength(4);
    expect(cells[0].textContent?.trim()).toBe('1 · Romance Dawn');
    expect(cells[0].querySelector('a')?.getAttribute('href')).toBe('/content/arcs/a1');
    expect(cells[1].querySelector('a')?.getAttribute('href')).toBe('/content/volumes/v1');
    expect(root.querySelector('input[type="search"]')?.getAttribute('placeholder')).toBe(
      'number or title…',
    );
  });

  it('sorts by number on the wire, flipping the direction on a second click', async () => {
    await open('/content/chapters', `page=0&${BY_NUMBER}`, ROWS);

    const header = Array.from(root.querySelectorAll('app-sort-header button')).find((button) =>
      button.textContent?.includes('No.'),
    ) as HTMLButtonElement;
    header.click();
    await settle();
    httpTesting.expectOne(`${CHAPTERS}?page=0&sort=number%2Cdesc`).flush(page([...ROWS].reverse()));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/content/chapters?sort=number,desc');
  });

  it('narrows by both relations, each with its own chip that removes only itself', async () => {
    await open(
      `/content/chapters?arc=${ARC_ID}&volume=${VOLUME_ID}`,
      `page=0&arc=${ARC_ID}&volume=${VOLUME_ID}&${BY_NUMBER}`,
      ROWS,
    );

    const chips = Array.from(root.querySelectorAll('[data-testid="relation-chip"]'));
    expect(chips.map((chip) => chip.textContent?.replace('✕', '').trim())).toEqual([
      'Arc: 1 · Romance Dawn',
      'Volume: 1 · Romance Dawn',
    ]);

    chips[0].querySelector('button')!.click();
    await settle();
    httpTesting.expectOne(`${CHAPTERS}?page=0&volume=${VOLUME_ID}&${BY_NUMBER}`).flush(page(ROWS));
    await settle();

    expect(root.querySelectorAll('[data-testid="relation-chip"]')).toHaveLength(1);
  });

  it('resets every relation filter when the filters are cleared', async () => {
    await open(
      `/content/chapters?arc=${ARC_ID}&volume=${VOLUME_ID}`,
      `page=0&arc=${ARC_ID}&volume=${VOLUME_ID}&${BY_NUMBER}`,
      [],
    );

    const reset = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Reset filters'),
    ) as HTMLButtonElement;
    reset.click();
    await settle();
    httpTesting.expectOne(`${CHAPTERS}?page=0&${BY_NUMBER}`).flush(page(ROWS));
    await settle();

    expect(root.querySelector('[data-testid="relation-filter"]')).toBeNull();
  });
});

describe('the related lists of a story card', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: ARC },
        provideRouter([]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows "number · title" and leads to the section filtered by the relation', async () => {
    const fixture = TestBed.createComponent(RelatedList);
    fixture.componentRef.setInput('section', ARC.sections![0]);
    fixture.componentRef.setInput('contentId', ARC_ID);
    fixture.detectChanges();
    httpTesting
      .expectOne(`${CHAPTERS}?arc=${ARC_ID}&size=12`)
      .flush(page([chapterRow('c1', 1, 'Romance Dawn'), chapterRow('c2', 2, 'Luffy')]));
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const names = Array.from(root.querySelectorAll('[data-testid="related-name"]')).map(
      (name) => name.textContent,
    );
    expect(names).toEqual(['1 · Romance Dawn', '2 · Luffy']);
    expect(root.querySelector('[data-testid="related-all"]')?.getAttribute('href')).toBe(
      `/content/chapters?arc=${ARC_ID}`,
    );
    expect(root.textContent).toContain('Chapters of this arc');
  });

  it('keeps the lists of one card apart: each asks its own entity under its own texts', async () => {
    const fixture = TestBed.createComponent(RelatedList);
    fixture.componentRef.setInput('section', ARC.sections![1]);
    fixture.componentRef.setInput('contentId', ARC_ID);
    fixture.detectChanges();
    httpTesting.expectOne(`/api/content/episodes?arc=${ARC_ID}&size=12`).flush(page([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No episode linked to this arc.',
    );
  });
});
