import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { DashboardStatus } from './dashboard-status';
import type { StatusPage, StatusRow } from './dashboard.model';

/** Where a row leads - the detail screen - not under test here. */
@Component({ template: '' })
class DetailStandIn {}

const ENDPOINT = '/api/content/dashboard/statuses/IN_REVIEW';
const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const ZORO = { id: 'u2', username: 'zoro', email: 'zoro@onepiece.local' };
const LAW = { id: 'u3', username: 'law', email: 'law@onepiece.local' };
const REVIEWER = ['content:read', 'content:review'];

function row(contentId: string, overrides: Partial<StatusRow> = {}): StatusRow {
  return {
    entityType: 'DEVIL_FRUIT_TYPE',
    contentId,
    versionNumber: 3,
    status: 'IN_REVIEW',
    title: { names: { en: `Logia ${contentId}` }, fallback: 'Shizen-kei' },
    author: NAMI,
    claimant: null,
    updatedAt: '2026-08-20T10:00:00Z',
    onlineVersionNumber: 2,
    allowedActions: ['CLAIM'],
    overrideActions: [],
    ...overrides,
  };
}

function page(
  rows: StatusRow[],
  overrides: Partial<StatusPage['rows']> = {},
  mine = 1,
): StatusPage {
  return {
    rows: {
      content: rows,
      page: 0,
      size: 20,
      totalElements: rows.length,
      totalPages: 1,
      ...overrides,
    },
    all: 2,
    mine,
  };
}

polyfillDialog();

describe('DashboardStatus', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    try {
      localStorage.removeItem('dashboard.legendOpen');
    } catch {
      // no storage in this environment: nothing to clear
    }
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'dashboard/:status', component: DashboardStatus },
            { path: 'content/devil-fruit-types/:id', component: DetailStandIn },
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

  /**
   * Lets a navigation, a signal change or an answered request settle - without waiting
   * for the app to be stable, which a request still pending would never let it be.
   */
  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  /** The pending request for a page of the status, whatever its query. */
  function pageRequest(): TestRequest {
    return httpTesting.expectOne(
      (request) => request.url.startsWith(ENDPOINT) && !request.url.endsWith('/authors'),
    );
  }

  async function open(url: string, answer: StatusPage, username = 'zoro'): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting
      .expectOne('/api/me')
      .flush({ username, email: `${username}@onepiece.local`, roles: [], permissions: REVIEWER });
    pageRequest().flush(answer);
    await settle();
    httpTesting.expectOne(`${ENDPOINT}/authors`).flush([NAMI]);
    await settle();
    root = harness.routeNativeElement as HTMLElement;
  }

  function rows(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="status-row"]'));
  }

  it('lists each content with its version, its claim and what the caller may do', async () => {
    await open(
      '/dashboard/in-review',
      page([
        row('c1', { claimant: ZORO, allowedActions: ['APPROVE', 'REJECT', 'RELEASE'] }),
        row('c2'),
      ]),
    );

    expect(rows()).toHaveLength(2);
    const link = rows()[0].querySelector<HTMLAnchorElement>('[data-testid="status-row-link"]')!;
    expect(link.querySelector('[data-testid="status-row-name"]')?.textContent?.trim()).toBe(
      'Logia c1',
    );
    expect(link.textContent).toContain('v3');
    expect(link.getAttribute('href')).toBe('/content/devil-fruit-types/c1?v=3');
    expect(rows()[0].querySelector('[data-testid="status-row-claim"]')?.textContent).toContain(
      'claimed by you',
    );
    const actions = Array.from(
      rows()[0].querySelectorAll<HTMLButtonElement>('[data-testid="status-row-action"]'),
    ).map((button) => button.dataset['action']);
    expect(actions).toEqual(['APPROVE', 'REJECT', 'RELEASE']);
    expect(root.querySelector('h1')?.textContent).toContain('In review');
  });

  it('shows the icon of the entity next to its name', async () => {
    await open('/dashboard/in-review', page([row('c1')]));

    const icons = Array.from(rows()[0].querySelectorAll('img')).map((image) =>
      image.getAttribute('src'),
    );
    expect(icons.length).toBeGreaterThan(0);
    expect(new Set(icons)).toEqual(new Set(['assets/devil-fruit-type.webp']));
  });

  it('shows a content of an entity the app has no pages for yet, without link or actions', async () => {
    await open('/dashboard/in-review', page([row('c1', { entityType: 'CHARACTER' })]));

    const link = rows()[0].querySelector<HTMLAnchorElement>('[data-testid="status-row-link"]')!;
    expect(link.querySelector('[data-testid="status-row-name"]')?.textContent?.trim()).toBe(
      'Logia c1',
    );
    expect(link.getAttribute('href')).toBeNull();
    expect(rows()[0].querySelectorAll('[data-testid="status-row-action"]')).toHaveLength(0);
    expect(rows()[0].textContent).toContain('Other content');
    const icons = Array.from(rows()[0].querySelectorAll('img')).map((image) =>
      image.getAttribute('src'),
    );
    expect(new Set(icons)).toEqual(new Set(['assets/contents.webp']));
  });

  it('says why a row offers nothing', async () => {
    await open('/dashboard/in-review', page([row('c1', { claimant: LAW, allowedActions: [] })]));

    expect(rows()[0].querySelector('[data-testid="status-row-note"]')?.textContent).toContain(
      'taken',
    );
  });

  it('switches to the reviews the caller holds, with both counters', async () => {
    await open('/dashboard/in-review', page([row('c1'), row('c2')]));

    const scopes = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-testid="status-scope"]'),
    );
    expect(scopes.map((scope) => scope.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'All in review 2',
      'Claimed by me 1',
    ]);

    scopes[1].click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/dashboard/in-review?mine=true');
    const request = pageRequest();
    expect(request.request.url).toContain('mine=true');
    request.flush(page([row('c1', { claimant: ZORO })]));
    await settle();
    expect(rows()).toHaveLength(1);
  });

  it('filters by author from the first page', async () => {
    await open(
      '/dashboard/in-review?page=1',
      page([row('c1')], { page: 1, totalPages: 2, totalElements: 21 }),
    );

    const author = root.querySelector<HTMLSelectElement>('[data-testid="status-filter-author"]')!;
    author.value = 'nami';
    author.dispatchEvent(new Event('change'));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/dashboard/in-review?author=nami');
    const request = pageRequest();
    expect(request.request.url).toContain('author=nami');
    expect(request.request.url).toContain('page=0');
    request.flush(page([row('c1')]));
    await settle();
  });

  it('runs an action from the row and reads the page again', async () => {
    await open('/dashboard/in-review', page([row('c1'), row('c2')]));

    rows()[1].querySelector<HTMLButtonElement>('[data-action="CLAIM"]')!.click();
    const claim = httpTesting.expectOne('/api/content/devil-fruit-types/c2/versions/3/claim');
    expect(claim.request.method).toBe('POST');
    claim.flush({});
    await settle();
    pageRequest().flush(
      page([row('c1'), row('c2', { claimant: ZORO, allowedActions: ['APPROVE'] })]),
    );
    await settle();
    httpTesting.expectOne(`${ENDPOINT}/authors`).flush([NAMI]);
    await settle();

    expect(TestBed.inject(Router).url).toBe('/dashboard/in-review');
    expect(rows()[1].querySelector('[data-testid="status-row-claim"]')).not.toBeNull();
  });

  describe('discarding a draft from its row', () => {
    const DRAFTS = '/api/content/dashboard/statuses/DRAFT';
    const EDITOR = ['content:read', 'content:write'];

    function draft(contentId: string, versionNumber: number): StatusRow {
      return row(contentId, {
        status: 'DRAFT',
        versionNumber,
        author: ZORO,
        allowedActions: ['EDIT', 'SUBMIT', 'DELETE'],
      });
    }

    async function openDrafts(answer: StatusPage): Promise<void> {
      harness = await RouterTestingHarness.create('/dashboard/draft');
      harness.detectChanges();
      httpTesting
        .expectOne('/api/me')
        .flush({ username: 'zoro', email: 'zoro@onepiece.local', roles: [], permissions: EDITOR });
      answerDrafts(answer);
      await settle();
      root = harness.routeNativeElement as HTMLElement;
    }

    function answerDrafts(answer: StatusPage): void {
      httpTesting
        .expectOne((request) => request.url.startsWith(DRAFTS) && !request.url.endsWith('/authors'))
        .flush(answer);
    }

    function discardDialog(): HTMLDialogElement | null {
      return root.querySelector('[data-testid="discard-dialog"] dialog');
    }

    it('asks first, worded for what is left, then removes it and reads the page again', async () => {
      await openDrafts(page([draft('c1', 3)]));
      httpTesting.expectOne(`${DRAFTS}/authors`).flush([ZORO]);
      await settle();

      rows()[0].querySelector<HTMLButtonElement>('[data-action="DELETE"]')!.click();
      await settle();
      expect(discardDialog()?.textContent).toContain('back to how it was in v2');

      discardDialog()!.querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')!.click();
      const removal = httpTesting.expectOne('/api/content/devil-fruit-types/c1/versions/3');
      expect(removal.request.method).toBe('DELETE');
      removal.flush(null);
      await settle();
      answerDrafts(page([]));
      await settle();
      httpTesting.expectOne(`${DRAFTS}/authors`).flush([]);
      await settle();

      expect(rows().length).toBe(0);
      expect(discardDialog()).toBeNull();
    });

    it('sends nothing when the discard is cancelled', async () => {
      await openDrafts(page([draft('c1', 1)]));
      httpTesting.expectOne(`${DRAFTS}/authors`).flush([ZORO]);
      await settle();

      rows()[0].querySelector<HTMLButtonElement>('[data-action="DELETE"]')!.click();
      await settle();
      expect(discardDialog()?.textContent).toContain('removed entirely');

      const cancel = Array.from(discardDialog()!.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Cancel',
      );
      cancel!.click();
      await settle();

      expect(discardDialog()).toBeNull();
    });
  });

  it('falls back to the previous page when an action empties the last one', async () => {
    await open(
      '/dashboard/in-review?page=1',
      page([row('c9')], { page: 1, totalPages: 2, totalElements: 21 }),
    );

    rows()[0].querySelector<HTMLButtonElement>('[data-action="CLAIM"]')!.click();
    httpTesting.expectOne('/api/content/devil-fruit-types/c9/versions/3/claim').flush({});
    await settle();
    pageRequest().flush(page([], { page: 1, totalPages: 1, totalElements: 20 }));
    await settle();
    httpTesting.expectOne(`${ENDPOINT}/authors`).flush([NAMI]);
    await settle();

    expect(TestBed.inject(Router).url).toBe('/dashboard/in-review');
    pageRequest().flush(page([row('c1')]));
    await settle();
  });

  it('opens the legend on request, and remembers it', async () => {
    await open('/dashboard/in-review', page([row('c1')]));
    expect(root.querySelector('[data-testid="status-legend"]')).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-testid="status-legend-toggle"]')!.click();
    harness.detectChanges();

    expect(root.querySelector('[data-testid="status-legend"]')?.textContent).toContain('Claim');
    expect(localStorage.getItem('dashboard.legendOpen')).toBe('1');
  });

  it('says when the caller holds no review', async () => {
    await open('/dashboard/in-review?mine=true', page([], {}, 0));

    expect(root.querySelector('[data-testid="status-empty"]')?.textContent).toContain(
      'You hold no reviews',
    );
  });
});
