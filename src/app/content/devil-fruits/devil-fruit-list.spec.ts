import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ENTITY } from '../entity/entities';
import { EntityList } from '../entity/entity-list';
import { DEVIL_FRUIT } from './devil-fruit.model';

const LIST = '/api/content/devil-fruits';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };

/** Where the type of a row leads: not under test here. */
@Component({ template: '' })
class Elsewhere {}

const LOGIA = { id: 't1', romaji: 'Shizen-kei', names: { it: 'Rogia', en: 'Logia' } };

function fruit(id: string, romaji: string, type: object | null) {
  return {
    id,
    versionNumber: 1,
    status: 'PUBLISHED',
    author: NAMI,
    updatedAt: '2026-08-20T10:00:00Z',
    onlineVersionNumber: 1,
    body: { romaji, names: { en: romaji }, type },
    allowedActions: [],
    overrideActions: [],
  };
}

function page(content: unknown[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  };
}

describe('the list of Devil Fruits', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: DEVIL_FRUIT },
        provideRouter([
          { path: 'content/devil-fruits', component: EntityList },
          { path: 'content/devil-fruit-types/:id', component: Elsewhere },
        ]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Opens the page at `url` as a reader and answers what it asks once, the list apart. */
  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read'],
    });
    httpTesting.expectOne(`${LIST}/summary`).flush({ total: 3, mine: 0, statuses: ['PUBLISHED'] });
    httpTesting.expectOne(`${LIST}/authors`).flush([NAMI]);
    root = harness.routeNativeElement as HTMLElement;
  }

  async function answerList(query: string, body: object): Promise<void> {
    httpTesting.expectOne(`${LIST}?${query}`).flush(body);
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function rows(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="content-row"]'));
  }

  function cell(row: HTMLElement): HTMLElement {
    return row.querySelector<HTMLElement>('[data-testid="relation-cell"]')!;
  }

  function chip(): HTMLElement | null {
    return root.querySelector('[data-testid="relation-filter"]');
  }

  it('shows the type of every fruit in a column of its own, as a link to the type', async () => {
    await open('/content/devil-fruits');
    await answerList(
      'page=0',
      page([fruit('f1', 'Mera Mera no Mi', LOGIA), fruit('f2', 'Draft Fruit', null)]),
    );

    expect(root.textContent).toContain('Type');
    expect(cell(rows()[0]).textContent?.trim()).toBe('Logia');
    expect(cell(rows()[0]).querySelector('a')?.getAttribute('href')).toBe(
      '/content/devil-fruit-types/t1',
    );
    expect(cell(rows()[1]).textContent?.trim()).toBe('—');
    expect(cell(rows()[1]).querySelector('a')).toBeNull();
  });

  it('asks for every fruit, with no chip, when the URL names no type', async () => {
    await open('/content/devil-fruits');
    await answerList('page=0', page([fruit('f1', 'Mera Mera no Mi', LOGIA)]));

    expect(chip()).toBeNull();
  });

  it('narrows the list to the type in the URL, and says which one in a chip', async () => {
    await open('/content/devil-fruits?type=t1');
    await answerList('page=0&type=t1', page([fruit('f1', 'Mera Mera no Mi', LOGIA)]));

    expect(chip()?.textContent?.replace(/\s+/g, ' ').trim()).toContain('Type: Logia');
    expect(rows().length).toBe(1);
  });

  it('names the type by its short serial when no fruit is left to name it', async () => {
    await open('/content/devil-fruits?type=3f2a9c1b-0000-4000-8000-000000000000');
    await answerList('page=0&type=3f2a9c1b-0000-4000-8000-000000000000', page([]));

    expect(chip()?.textContent).toContain('#3F2A9C1B');
    expect(root.textContent).toContain('No content matches these filters');
  });

  it('lifts the narrowing from the chip, back to every fruit', async () => {
    await open('/content/devil-fruits?type=t1');
    await answerList('page=0&type=t1', page([fruit('f1', 'Mera Mera no Mi', LOGIA)]));

    chip()?.querySelector<HTMLButtonElement>('button')?.click();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    await answerList('page=0', page([fruit('f1', 'Mera Mera no Mi', LOGIA)]));

    expect(TestBed.inject(Router).url).toBe('/content/devil-fruits');
    expect(chip()).toBeNull();
  });
});
