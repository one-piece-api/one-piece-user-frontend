import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { DevilFruitTypeList } from './devil-fruit-type-list';

const LIST = '/api/content/devil-fruit-types';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const CHOPPER = { id: 'u2', username: 'chopper', email: 'chopper@onepiece.local' };

const EDITOR = ['content:read', 'content:write'];
const REVIEWER = ['content:read', 'content:review'];
const PUBLISHER = ['content:read', 'content:publish'];

const ALL_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'REJECTED',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'ARCHIVED',
  'RETIRED',
  'SUPERSEDED',
];

/** Paramisia: a draft v3 by chopper over the online v2. */
const PARAMECIA = {
  id: 'c1',
  versionNumber: 3,
  status: 'DRAFT',
  author: CHOPPER,
  updatedAt: new Date().toISOString(),
  onlineVersionNumber: 2,
  body: { romaji: 'Chōjin-kei', names: { it: 'Paramisia', en: 'Paramecia' } },
};

/** Logia: online with its only version, by nami. */
const LOGIA = {
  id: 'c2',
  versionNumber: 1,
  status: 'PUBLISHED',
  author: NAMI,
  updatedAt: '2026-08-20T10:00:00Z',
  onlineVersionNumber: 1,
  body: { romaji: 'Shizen-kei', names: { it: 'Rogia', en: 'Logia' } },
};

function page(content: unknown[], overrides: Record<string, number> = {}) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
    ...overrides,
  };
}

describe('DevilFruitTypeList', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'content/devil-fruit-types', component: DevilFruitTypeList }]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /**
   * Opens the page at `url` as `username` and answers what it asks once, whatever the view:
   * who the caller is, the section's summary and its authors.
   */
  async function open(
    url: string,
    username: string,
    permissions: string[],
    summary = { total: 24, mine: 8, statuses: ALL_STATUSES },
  ): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting
      .expectOne('/api/me')
      .flush({ username, email: `${username}@onepiece.local`, roles: [], permissions });
    httpTesting.expectOne(`${LIST}/summary`).flush(summary);
    httpTesting.expectOne(`${LIST}/authors`).flush([CHOPPER, NAMI]);
    root = harness.routeNativeElement as HTMLElement;
  }

  /** Answers the list request for the given query string and lets the page render it. */
  async function answerList(query: string, body: object): Promise<void> {
    httpTesting.expectOne(`${LIST}?${query}`).flush(body);
    await settle();
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /**
   * Lets the navigation a click or a choice started finish. Unlike `settle`, it does not
   * wait for the app to be stable: the list request that navigation triggers is still
   * pending, on purpose, for the test to answer.
   */
  async function afterInteraction(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }

  function rows(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="content-row"]'));
  }

  function selects(): HTMLSelectElement[] {
    return Array.from(root.querySelectorAll('select'));
  }

  async function choose(select: HTMLSelectElement, value: string): Promise<void> {
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await afterInteraction();
  }

  function currentUrl(): string {
    return TestBed.inject(Router).url;
  }

  it('shows the section header, the breadcrumb and one row per content', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([PARAMECIA, LOGIA]));

    expect(root.querySelector('h1')?.textContent).toContain('Devil Fruit Types');
    expect(root.querySelector('nav[aria-label="breadcrumb"]')?.textContent).toContain('Contents');
    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('Paramecia');
    expect(rows()[0].textContent).toContain('Chōjin-kei');
    expect(rows()[0].textContent).toContain('v3');
    expect(rows()[0].textContent).toContain('Draft');
    expect(rows()[0].textContent).toContain('chopper');
    expect(rows()[0].textContent).toContain('today');
  });

  it('opens the detail of a content from its row', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([PARAMECIA, LOGIA]));

    expect(rows()[0].querySelector('a')?.getAttribute('href')).toBe(
      '/content/devil-fruit-types/c1',
    );
  });

  it('flags the online version only when it is not the one the row shows', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([PARAMECIA, LOGIA]));

    expect(rows()[0].textContent).toContain('v2 online');
    expect(rows()[1].textContent).not.toContain('online');
  });

  it('shows the caller as "You" on the versions they authored', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([PARAMECIA, LOGIA]));

    expect(rows()[1].textContent).toContain('You');
    expect(rows()[1].textContent).not.toContain('nami');
    expect(rows()[0].textContent).toContain('chopper');
  });

  it('falls back to the romaji, then to "Unnamed", when a version has no name yet', async () => {
    const unnamed = { ...LOGIA, id: 'c3', body: { romaji: 'Sara Sara', names: {} } };
    const blank = { ...LOGIA, id: 'c4', body: { romaji: null, names: {} } };
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([unnamed, blank]));

    expect(rows()[0].textContent).toContain('Sara Sara');
    expect(rows()[1].textContent).toContain('Unnamed');
    expect(rows()[1].textContent).toContain('romaji to be defined');
  });

  it('counts the result against the whole section and the share of the caller', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([PARAMECIA, LOGIA], { totalElements: 20 }));

    expect(root.textContent).toContain('20 of 24 entries · 8 yours');
  });

  it('tells who cannot write that drafts are hidden, instead of their share', async () => {
    await open('/content/devil-fruit-types', 'zoro', REVIEWER, {
      total: 20,
      mine: 0,
      statuses: ['IN_REVIEW', 'PUBLISHED'],
    });
    await answerList('page=0', page([LOGIA]));

    expect(root.textContent).toContain('1 of 20 entries · drafts are not visible to your role');
    expect(root.textContent).not.toContain('yours');
  });

  it('offers as status filters only the statuses the backend lists for the caller', async () => {
    await open('/content/devil-fruit-types', 'zoro', REVIEWER, {
      total: 20,
      mine: 0,
      statuses: ['IN_REVIEW', 'PUBLISHED'],
    });
    await answerList('page=0', page([LOGIA]));

    const labels = Array.from(selects()[0].options).map((option) => option.textContent?.trim());
    expect(labels).toEqual(['All statuses', 'In review', 'Published']);
  });

  it('hides "+ New" from who cannot write', async () => {
    await open('/content/devil-fruit-types', 'zoro', REVIEWER);
    await answerList('page=0', page([LOGIA]));

    expect(root.textContent).not.toContain('New fruit type');
  });

  it('shows "+ New" to who can write, leading to the editor of a new content', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([LOGIA]));
    const link = Array.from(root.querySelectorAll('a')).find((candidate) =>
      candidate.textContent?.includes('New fruit type'),
    );

    expect(link?.getAttribute('href')).toBe('/content/devil-fruit-types/new');
  });

  it('tells an editor they see every draft but edit only their own', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([LOGIA]));

    expect(root.textContent).toContain('You see every draft of the crew but edit only your own');
    expect(root.textContent).not.toContain('You review');
  });

  it('tells a reviewer that drafts stay with the editors and what they review', async () => {
    await open('/content/devil-fruit-types', 'zoro', REVIEWER);
    await answerList('page=0', page([LOGIA]));

    expect(root.textContent).toContain('Drafts stay with the editors');
    expect(root.textContent).toContain('You review the ones written by others.');
    expect(root.textContent).not.toContain('You publish');
  });

  it('tells a publisher what they publish', async () => {
    await open('/content/devil-fruit-types', 'vivi', PUBLISHER);
    await answerList('page=0', page([LOGIA]));

    expect(root.textContent).toContain('You publish the ones ready to publish.');
    expect(root.textContent).not.toContain('You review');
  });

  it('sends each filter to the backend and keeps it in the URL', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([PARAMECIA, LOGIA]));

    await choose(selects()[0], 'DRAFT');
    await answerList('page=0&status=DRAFT', page([PARAMECIA]));
    expect(currentUrl()).toBe('/content/devil-fruit-types?status=DRAFT');

    await choose(selects()[1], 'nami');
    await answerList('page=0&status=DRAFT&author=nami', page([]));
    expect(currentUrl()).toBe('/content/devil-fruit-types?status=DRAFT&author=nami');

    await choose(selects()[2], '7');
    await answerList('page=0&status=DRAFT&author=nami&updatedWithinDays=7', page([]));
    expect(currentUrl()).toBe('/content/devil-fruit-types?status=DRAFT&author=nami&updated=7');
  });

  it('searches a moment after the typing stops, not at every keystroke', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    await answerList('page=0', page([PARAMECIA, LOGIA]));

    const input = root.querySelector('input') as HTMLInputElement;
    for (const text of ['l', 'lo', 'logia']) {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    await afterInteraction();

    await answerList('page=0&q=logia', page([LOGIA]));
    expect(currentUrl()).toBe('/content/devil-fruit-types?q=logia');
  });

  it('restores page and filters from the URL', async () => {
    await open(
      '/content/devil-fruit-types?page=1&status=PUBLISHED&q=zoan&updated=30',
      'nami',
      EDITOR,
    );
    await answerList(
      'page=1&q=zoan&status=PUBLISHED&updatedWithinDays=30',
      page([LOGIA], { page: 1, totalElements: 21, totalPages: 2 }),
    );

    expect((root.querySelector('input') as HTMLInputElement).value).toBe('zoan');
    expect(selects()[0].value).toBe('PUBLISHED');
    expect(selects()[2].value).toBe('30');
    expect(root.textContent).toContain('21–21 of 21');
  });

  it('goes back to the first page when a filter changes', async () => {
    await open('/content/devil-fruit-types?page=1', 'nami', EDITOR);
    await answerList('page=1', page([LOGIA], { page: 1, totalElements: 21, totalPages: 2 }));

    await choose(selects()[0], 'PUBLISHED');
    await answerList('page=0&status=PUBLISHED', page([LOGIA]));

    expect(currentUrl()).toBe('/content/devil-fruit-types?status=PUBLISHED');
  });

  it('pages through the result, keeping the filters', async () => {
    await open('/content/devil-fruit-types?status=PUBLISHED', 'nami', EDITOR);
    await answerList(
      'page=0&status=PUBLISHED',
      page([LOGIA], { totalElements: 21, totalPages: 2 }),
    );
    expect(root.textContent).toContain('1–1 of 21');

    const next = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '→',
    );
    next?.click();
    await afterInteraction();
    await answerList(
      'page=1&status=PUBLISHED',
      page([LOGIA], { page: 1, totalElements: 21, totalPages: 2 }),
    );

    expect(currentUrl()).toBe('/content/devil-fruit-types?status=PUBLISHED&page=1');
  });

  it('clears every filter with "Reset"', async () => {
    await open(
      '/content/devil-fruit-types?page=1&status=DRAFT&author=nami&q=x&updated=7',
      'nami',
      EDITOR,
    );
    await answerList('page=1&q=x&status=DRAFT&author=nami&updatedWithinDays=7', page([]));

    const reset = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reset',
    );
    reset?.click();
    await afterInteraction();
    await answerList('page=0', page([PARAMECIA, LOGIA]));

    expect(currentUrl()).toBe('/content/devil-fruit-types');
    expect(rows().length).toBe(2);
  });

  it('tells an editor an empty section is theirs to start', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR, {
      total: 0,
      mine: 0,
      statuses: ALL_STATUSES,
    });
    await answerList('page=0', page([]));

    expect(root.textContent).toContain('Nothing here yet');
    expect(root.textContent).toContain('Create the first content with the button above.');
  });

  it('tells who cannot write that an empty section will fill from review', async () => {
    await open('/content/devil-fruit-types', 'zoro', REVIEWER, {
      total: 0,
      mine: 0,
      statuses: ['IN_REVIEW'],
    });
    await answerList('page=0', page([]));
    expect(root.textContent).toContain("When something reaches review, you'll see it here.");
  });

  it('says no content matches when the section has contents but the filters hide them', async () => {
    await open('/content/devil-fruit-types?status=REJECTED', 'nami', EDITOR);
    await answerList('page=0&status=REJECTED', page([]));

    expect(root.textContent).toContain('No content matches these filters');
    expect(root.textContent).not.toContain('Nothing here yet');

    const resetFilters = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reset filters',
    );
    resetFilters?.click();
    await afterInteraction();
    await answerList('page=0', page([LOGIA]));
    expect(rows().length).toBe(1);
  });

  it('shows an error when the list cannot be loaded', async () => {
    await open('/content/devil-fruit-types', 'nami', EDITOR);
    httpTesting.expectOne(`${LIST}?page=0`).flush('nope', { status: 500, statusText: 'Error' });
    await settle();

    expect(root.textContent).toContain('Lost the encyclopedia');
  });
});
