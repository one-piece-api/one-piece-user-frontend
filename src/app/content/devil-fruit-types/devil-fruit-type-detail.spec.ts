import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import type { VersionStatus } from '../content.model';
import { DevilFruitTypeDetail } from './devil-fruit-type-detail';

const ID = '3f2a9c1b-0000-4000-8000-000000000001';
const DETAIL = `/api/content/devil-fruit-types/${ID}`;
const PAGE = `/content/devil-fruit-types/${ID}`;

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const CHOPPER = { id: 'u2', username: 'chopper', email: 'chopper@onepiece.local' };

const EDITOR = ['content:read', 'content:write'];
const REVIEWER = ['content:read', 'content:review'];

function summary(number: number, status: VersionStatus, author = NAMI) {
  return {
    number,
    status,
    author,
    basedOn: number === 1 ? null : number - 1,
    claimant: null,
    everPublished: status === 'PUBLISHED' || status === 'SUPERSEDED',
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  };
}

/** v1 superseded, v2 online, v3 a draft by chopper - what an editor sees. */
const V1 = summary(1, 'SUPERSEDED');
const V2 = summary(2, 'PUBLISHED');
const V3 = summary(3, 'DRAFT', CHOPPER);

function body(name: string, italianDescription: string | null = 'Elementale.') {
  return {
    romaji: 'Shizen-kei',
    translations: {
      en: { name, description: 'Elemental.' },
      it: { name: 'Rogia', description: italianDescription },
    },
  };
}

describe('DevilFruitTypeDetail', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [{ path: 'content/devil-fruit-types/:id', component: DevilFruitTypeDetail }],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Opens the page at `url` as `username` and answers who the caller is and the catalog. */
  async function open(url: string, username: string, permissions: string[]): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting
      .expectOne('/api/me')
      .flush({ username, email: `${username}@onepiece.local`, roles: [], permissions });
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    root = harness.routeNativeElement as HTMLElement;
  }

  /** Answers the content request with its chain; the page then asks for one version. */
  async function answerContent(versions: object[], onlineVersionNumber: number | null) {
    httpTesting.expectOne(DETAIL).flush({ id: ID, onlineVersionNumber, versions });
    await afterInteraction();
  }

  async function answerVersion(version: ReturnType<typeof summary>, versionBody: object) {
    httpTesting
      .expectOne(`${DETAIL}/versions/${version.number}`)
      .flush({ ...version, rejectionReason: null, body: versionBody });
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Lets a navigation or a signal change settle, leaving the next request pending. */
  async function afterInteraction(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }

  function circles(): HTMLButtonElement[] {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testid="version-link"]'));
  }

  function selectedBar(): string {
    return root.querySelector('[data-testid="selected-version"]')?.textContent?.trim() ?? '';
  }

  function tab(label: string): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((candidate) =>
      candidate.textContent?.includes(label),
    );
  }

  it('shows the most recent visible version: header, chain and card', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft'));

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Logia draft');
    expect(root.textContent).toContain('Fruit Type');
    expect(root.textContent).toContain('#3F2A9C1B');
    expect(root.textContent).toContain('Shizen-kei');
    expect(root.querySelector('header app-status-badge')?.textContent).toContain('Draft');
    expect(root.textContent).toContain('3 versions');
    expect(circles().length).toBe(3);
    expect(root.querySelector('[data-testid="card-name"]')?.textContent).toContain('Logia draft');
  });

  it('leads back to the section from the breadcrumb, ending on the content', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft'));

    const breadcrumb = root.querySelector('nav[aria-label="breadcrumb"]') as HTMLElement;
    expect(breadcrumb.querySelector('a')?.getAttribute('href')).toBe('/content/devil-fruit-types');
    expect(breadcrumb.querySelector('[aria-current="page"]')?.textContent).toContain('Logia draft');
  });

  it('describes the selected version: who wrote it and that it is the most recent', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft'));

    expect(selectedBar()).toContain('v3 · Draft');
    expect(selectedBar()).toContain('by chopper');
    expect(selectedBar()).toContain('the most recent');
    expect(selectedBar()).not.toContain('visible to your role');
  });

  it('shows the content of the version that is picked, and keeps it in the URL', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft'));

    circles()[2].click();
    await afterInteraction();
    await answerVersion(V1, body('Logia first'));

    expect(TestBed.inject(Router).url).toBe(`${PAGE}?v=1`);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Logia first');
    expect(root.querySelector('header app-status-badge')?.textContent).toContain('Superseded');
    expect(selectedBar()).toContain('v1 · Superseded');
    expect(selectedBar()).toContain('by You');
    expect(selectedBar()).not.toContain('the most recent');
  });

  it('opens on the version the URL asks for', async () => {
    await open(`${PAGE}?v=2`, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V2, body('Logia'));

    expect(selectedBar()).toContain('v2 · Published');
    expect(circles()[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('falls back to the most recent version when the URL asks for one the caller cannot see', async () => {
    await open(`${PAGE}?v=3`, 'zoro', REVIEWER);
    await answerContent([V1, V2], 2);
    await answerVersion(V2, body('Logia'));

    expect(selectedBar()).toContain('v2 · Published');
  });

  it('shows a reviewer the chain without drafts, saying it is the most recent they may see', async () => {
    await open(PAGE, 'zoro', REVIEWER);
    await answerContent([V1, V2], 2);
    await answerVersion(V2, body('Logia'));

    expect(circles().map((circle) => circle.textContent?.trim().slice(0, 2))).toEqual(['v2', 'v1']);
    expect(root.textContent).toContain('2 versions');
    expect(selectedBar()).toContain('the most recent visible to your role');
  });

  it('shows the picked language of the card and marks the incomplete one', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft', null));

    const [italian, english] = Array.from(
      root.querySelectorAll<HTMLButtonElement>('app-devil-fruit-type-card [role="tab"]'),
    );
    expect(italian.querySelector('[data-testid="incomplete-marker"]')).not.toBeNull();
    expect(english.querySelector('[data-testid="incomplete-marker"]')).toBeNull();

    italian.click();
    harness.detectChanges();

    expect(root.querySelector('[data-testid="card-name"]')?.textContent).toContain('Rogia');
    expect(root.querySelector('[data-testid="card-description"]')?.textContent).toContain(
      'no description in this language',
    );
  });

  it('opens the Workflow tab from the URL and goes back to the overview', async () => {
    await open(`${PAGE}?tab=workflow`, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft'));

    expect(tab('Workflow')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('app-devil-fruit-type-card')).toBeNull();
    expect(root.textContent).toContain('still in the shipyard');

    tab('Overview')?.click();
    await afterInteraction();

    expect(TestBed.inject(Router).url).toBe(PAGE);
    expect(root.querySelector('app-devil-fruit-type-card')).not.toBeNull();
  });

  it('says the content is not found when the caller may not see it', async () => {
    await open(PAGE, 'zoro', REVIEWER);
    httpTesting.expectOne(DETAIL).flush('nope', { status: 404, statusText: 'Not Found' });
    await afterInteraction();

    expect(root.textContent).toContain('Content not found');
    expect(root.querySelector('article')).toBeNull();
    const back = Array.from(root.querySelectorAll('a')).find((link) =>
      link.textContent?.includes('Back to the list'),
    );
    expect(back?.getAttribute('href')).toBe('/content/devil-fruit-types');
  });

  it('shows an error when the content cannot be loaded', async () => {
    await open(PAGE, 'nami', EDITOR);
    httpTesting.expectOne(DETAIL).flush('nope', { status: 500, statusText: 'Error' });
    await afterInteraction();

    expect(root.textContent).toContain('Lost the card');
    expect(root.textContent).not.toContain('Content not found');
  });
});
