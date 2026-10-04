import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MascotService } from '../../shared/mascot/mascot';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import type { VersionStatus } from '../content.model';
import { DevilFruitTypeDetail } from './devil-fruit-type-detail';

const ID = '3f2a9c1b-0000-4000-8000-000000000001';

/** Where the page leads away to - the editor, the list - not under test here. */
@Component({ template: '' })
class EditorStandIn {}
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
    overrideActions: [] as string[],
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  };
}

/** v1 superseded, v2 online, v3 a draft by chopper - what an editor sees. */
const V1 = summary(1, 'SUPERSEDED');
const V2 = summary(2, 'PUBLISHED');
const V3 = summary(3, 'DRAFT', CHOPPER);

/** One audit record of a version, as the events endpoint returns it. */
const CREATED = {
  action: 'VERSION_CREATED',
  actor: CHOPPER,
  detail: null,
  override: false,
  occurredAt: '2026-08-20T10:00:00Z',
};

function body(name: string, italianDescription: string | null = 'Elementale.') {
  return {
    romaji: 'Shizen-kei',
    translations: {
      en: {
        name,
        description: 'Elemental.',
        advantages: 'Attacks pass through.',
        disadvantages: 'Haki and sea water.',
      },
      it: {
        name: 'Rogia',
        description: italianDescription,
        advantages: 'Intangibile.',
        disadvantages: 'Haki e acqua di mare.',
      },
    },
  };
}

polyfillDialog();

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
          [
            { path: 'content/devil-fruit-types/:id', component: DevilFruitTypeDetail },
            { path: 'content/devil-fruit-types/:id/edit', component: EditorStandIn },
            { path: 'content/devil-fruit-types', component: EditorStandIn },
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

  /** Answers the two requests a selected version makes: what it says, and its history. */
  async function answerVersion(
    version: ReturnType<typeof summary>,
    versionBody: object,
    events: object[] = [],
  ) {
    const url = `${DETAIL}/versions/${version.number}`;
    httpTesting
      .expectOne(url)
      .flush({ ...version, rejectionReason: null, body: versionBody, allowedActions: [] });
    httpTesting.expectOne(`${url}/events`).flush(events);
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

  it('leads back to the dashboard and the section from the breadcrumb, ending on the content', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft'));

    const breadcrumb = root.querySelector('nav[aria-label="breadcrumb"]') as HTMLElement;
    const links = [...breadcrumb.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(links).toEqual(['/dashboard', '/content/devil-fruit-types']);
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
    await answerVersion(V3, body('Logia draft'), [CREATED]);

    expect(tab('Workflow')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('app-devil-fruit-type-card')).toBeNull();
    expect(root.textContent).toContain('Editorial route');
    expect(root.textContent).toContain('Workflow timeline');
    expect(root.textContent).toContain('Your permissions here');
    expect(root.querySelectorAll('[data-testid="timeline-step"]').length).toBe(1);

    tab('Overview')?.click();
    await afterInteraction();

    expect(TestBed.inject(Router).url).toBe(PAGE);
    expect(root.querySelector('app-devil-fruit-type-card')).not.toBeNull();
  });

  it('counts the events of the selected version on the Workflow tab', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    await answerVersion(V3, body('Logia draft'), [CREATED]);
    expect(tab('Workflow')?.querySelector('[data-testid="event-count"]')?.textContent).toBe('1');

    circles()[1].click();
    await afterInteraction();
    await answerVersion(V2, body('Logia'), [CREATED, CREATED, CREATED]);

    expect(tab('Workflow')?.querySelector('[data-testid="event-count"]')?.textContent).toBe('3');
  });

  it('shows an error when the history of the version cannot be loaded', async () => {
    await open(PAGE, 'nami', EDITOR);
    await answerContent([V1, V2, V3], 2);
    httpTesting
      .expectOne(`${DETAIL}/versions/3`)
      .flush({ ...V3, rejectionReason: null, body: body('Logia draft'), allowedActions: [] });
    httpTesting
      .expectOne(`${DETAIL}/versions/3/events`)
      .flush('nope', { status: 500, statusText: 'Error' });
    await afterInteraction();

    expect(root.textContent).toContain('Lost the card');
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

  it('opens the editor from the Draft status of the caller’s own draft', async () => {
    const draft = summary(3, 'DRAFT');
    await open(`${PAGE}?tab=workflow`, 'nami', EDITOR);
    await answerContent([V1, V2, draft], 2);
    const url = `${DETAIL}/versions/3`;
    httpTesting.expectOne(url).flush({
      ...draft,
      rejectionReason: null,
      body: body('Logia draft'),
      allowedActions: ['EDIT', 'DELETE', 'SUBMIT'],
    });
    httpTesting.expectOne(`${url}/events`).flush([CREATED]);
    await harness.fixture.whenStable();
    harness.detectChanges();

    root
      .querySelector<HTMLButtonElement>('button[data-testid="route-node"][data-status="DRAFT"]')!
      .click();
    await afterInteraction();

    expect(TestBed.inject(Router).url).toBe(`${PAGE}/edit`);
  });

  describe('moving the version along the route', () => {
    const DRAFT = summary(3, 'DRAFT');
    const VERSION = `${DETAIL}/versions/3`;

    /** nami's own v3 draft, open on the Workflow tab. */
    async function openOwnDraft(): Promise<void> {
      await open(`${PAGE}?tab=workflow`, 'nami', EDITOR);
      await answerContent([V1, V2, DRAFT], 2);
      await answerOwnVersion('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);
    }

    async function answerOwnVersion(
      status: VersionStatus,
      allowedActions: string[],
      rejectionReason: string | null = null,
      events: object[] = [CREATED],
    ) {
      httpTesting.expectOne(VERSION).flush({
        ...summary(3, status),
        rejectionReason,
        body: body('Logia draft'),
        allowedActions,
      });
      httpTesting.expectOne(`${VERSION}/events`).flush(events);
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    /** The page reloads the content and the version after every attempt, refused or not. */
    async function answerReload(
      status: VersionStatus,
      allowedActions: string[],
      rejectionReason: string | null = null,
      events: object[] = [CREATED],
    ) {
      httpTesting
        .expectOne(DETAIL)
        .flush({ id: ID, onlineVersionNumber: 2, versions: [V1, V2, summary(3, status)] });
      await afterInteraction();
      await answerOwnVersion(status, allowedActions, rejectionReason, events);
    }

    function node(status: VersionStatus): HTMLButtonElement {
      return root.querySelector<HTMLButtonElement>(
        `button[data-testid="route-node"][data-status="${status}"]`,
      )!;
    }

    function mascotSays(): string {
      return TestBed.inject(MascotService).message().text;
    }

    it('submits the draft from the In review status and shows it in review', async () => {
      await openOwnDraft();

      node('IN_REVIEW').click();
      harness.detectChanges();
      expect(node('IN_REVIEW').disabled).toBe(true);
      const submit = httpTesting.expectOne(`${VERSION}/submit`);
      expect(submit.request.method).toBe('POST');
      submit.flush({});
      await afterInteraction();
      await answerReload('IN_REVIEW', ['PULL_BACK']);

      expect(mascotSays()).toContain('Submitted for review!');
      expect(root.querySelector('[aria-current="step"]')?.getAttribute('data-status')).toBe(
        'IN_REVIEW',
      );
      expect(node('DRAFT').dataset['state']).toBe('next');
    });

    it('lists what an incomplete draft still lacks, in words', async () => {
      await openOwnDraft();

      node('IN_REVIEW').click();
      httpTesting.expectOne(`${VERSION}/submit`).flush(
        {
          errorCode: 'CONTENT_VERSION_INCOMPLETE',
          errors: [
            { field: 'romaji', message: 'is required for review' },
            { field: 'translations[en].description', message: 'is required for review' },
            { field: 'translations[it].disadvantages', message: 'is required for review' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await afterInteraction();
      await answerReload('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);

      expect(mascotSays()).toBe(
        'Arrr! Still missing before review: romaji, description EN, disadvantages IT.',
      );
    });

    it('names the version a submission would repeat', async () => {
      await openOwnDraft();

      node('IN_REVIEW').click();
      httpTesting
        .expectOne(`${VERSION}/submit`)
        .flush(
          { errorCode: 'CONTENT_VERSION_IDENTICAL', identicalTo: 1 },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      await afterInteraction();
      await answerReload('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);

      expect(mascotSays()).toContain('identical to v1');
    });

    it('pulls an unclaimed version back from the Draft status', async () => {
      await open(`${PAGE}?tab=workflow`, 'nami', EDITOR);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['PULL_BACK']);

      node('DRAFT').click();
      httpTesting.expectOne(`${VERSION}/pull-back`).flush({});
      await afterInteraction();
      await answerReload('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);

      expect(mascotSays()).toContain('Pulled back from review');
      expect(node('DRAFT').getAttribute('aria-current')).toBe('step');
    });

    it('shows the version as it now is when someone acted first', async () => {
      await open(`${PAGE}?tab=workflow`, 'nami', EDITOR);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['PULL_BACK']);

      node('DRAFT').click();
      httpTesting
        .expectOne(`${VERSION}/pull-back`)
        .flush(
          { errorCode: 'CONTENT_VERSION_ACTION_CONFLICT' },
          { status: 409, statusText: 'Conflict' },
        );
      await afterInteraction();
      await answerReload('IN_REVIEW', []);

      expect(mascotSays()).toContain('changed in the meantime');
      expect(root.querySelectorAll('button[data-testid="route-node"]').length).toBe(0);
    });

    it('claims a version in review from its own status, which then offers to release it', async () => {
      await open(`${PAGE}?tab=workflow`, 'zoro', REVIEWER);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['CLAIM']);

      node('IN_REVIEW').click();
      const claim = httpTesting.expectOne(`${VERSION}/claim`);
      expect(claim.request.method).toBe('POST');
      claim.flush({});
      await afterInteraction();
      await answerReload('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT']);

      expect(mascotSays()).toContain('Claimed: you can now approve or reject it.');
      expect(TestBed.inject(MascotService).message().tone).toBe('success');
      expect(node('IN_REVIEW').title).toBe('Click to release the review');
    });

    it('releases a claimed version and says so as information', async () => {
      await open(`${PAGE}?tab=workflow`, 'zoro', REVIEWER);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT']);

      node('IN_REVIEW').click();
      httpTesting.expectOne(`${VERSION}/release`).flush({});
      await afterInteraction();
      await answerReload('IN_REVIEW', ['CLAIM']);

      expect(mascotSays()).toContain('Released:');
      expect(TestBed.inject(MascotService).message().tone).toBe('info');
      expect(node('IN_REVIEW').title).toBe('Click to claim the review');
    });

    it('shows who got there first when another reviewer claimed the version meanwhile', async () => {
      await open(`${PAGE}?tab=workflow`, 'zoro', REVIEWER);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['CLAIM']);

      node('IN_REVIEW').click();
      httpTesting
        .expectOne(`${VERSION}/claim`)
        .flush({ errorCode: 'CONCURRENT_MODIFICATION' }, { status: 409, statusText: 'Conflict' });
      await afterInteraction();
      await answerReload('IN_REVIEW', []);

      expect(mascotSays()).toContain('changed in the meantime');
      expect(root.querySelectorAll('button[data-testid="route-node"]').length).toBe(0);
    });

    const REASON = 'The English description is missing.';
    const REJECTED_BY_ZORO = {
      action: 'VERSION_REJECTED',
      actor: { id: 'u3', username: 'zoro', email: 'zoro@onepiece.local' },
      detail: REASON,
      occurredAt: '2026-08-20T11:00:00Z',
    };

    function rejectDialog(): HTMLDialogElement {
      return root.querySelector('app-reject-dialog dialog')!;
    }

    it('approves a version the caller holds from the Ready to publish status', async () => {
      await open(`${PAGE}?tab=workflow`, 'zoro', REVIEWER);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT']);

      expect(node('READY_TO_PUBLISH').dataset['state']).toBe('next');
      node('READY_TO_PUBLISH').click();
      const approve = httpTesting.expectOne(`${VERSION}/approve`);
      expect(approve.request.method).toBe('POST');
      approve.flush({});
      await afterInteraction();
      await answerReload('READY_TO_PUBLISH', []);

      expect(mascotSays()).toContain('Approved!');
      expect(node('READY_TO_PUBLISH')).toBeNull();
    });

    it('asks the reason before rejecting, then sends it and shows the version rejected', async () => {
      await open(`${PAGE}?tab=workflow`, 'zoro', REVIEWER);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT']);

      node('REJECTED').click();
      harness.detectChanges();
      expect(rejectDialog().open).toBe(true);
      expect(rejectDialog().textContent).toContain('Logia draft · Fruit Type by nami');
      httpTesting.expectNone(`${VERSION}/reject`);

      const reason = rejectDialog().querySelector<HTMLTextAreaElement>('textarea')!;
      reason.value = `  ${REASON}  `;
      reason.dispatchEvent(new Event('input'));
      harness.detectChanges();
      rejectDialog().querySelector<HTMLButtonElement>('[data-testid="reject-action"]')!.click();
      const reject = httpTesting.expectOne(`${VERSION}/reject`);
      expect(reject.request.body).toEqual({ reason: REASON });
      reject.flush({});
      await afterInteraction();
      // A reviewer does not see rejected versions: the chain falls back to the online one.
      httpTesting.expectOne(DETAIL).flush({ id: ID, onlineVersionNumber: 2, versions: [V1, V2] });
      await afterInteraction();
      await answerVersion(V2, body('Logia'));

      expect(rejectDialog().open).toBe(false);
      expect(selectedBar()).toContain('v2 · Published');
      expect(mascotSays()).toContain('it goes back to nami with your reason');
      expect(TestBed.inject(MascotService).message().tone).toBe('info');
    });

    it('leads back to the list when the caller no longer sees anything of the content', async () => {
      await open(`${PAGE}?tab=workflow`, 'zoro', REVIEWER);
      await answerContent([summary(3, 'IN_REVIEW')], null);
      await answerOwnVersion('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT']);

      node('REJECTED').click();
      harness.detectChanges();
      const reason = rejectDialog().querySelector<HTMLTextAreaElement>('textarea')!;
      reason.value = REASON;
      reason.dispatchEvent(new Event('input'));
      harness.detectChanges();
      rejectDialog().querySelector<HTMLButtonElement>('[data-testid="reject-action"]')!.click();
      httpTesting.expectOne(`${VERSION}/reject`).flush({});
      await afterInteraction();
      httpTesting
        .expectOne(DETAIL)
        .flush(
          { errorCode: 'CONTENT_DEVIL_FRUIT_TYPE_NOT_FOUND' },
          { status: 404, statusText: 'Not Found' },
        );
      await afterInteraction();

      expect(TestBed.inject(Router).url).toBe('/content/devil-fruit-types');
      expect(mascotSays()).toContain('it goes back to nami with your reason');
    });

    it('sends nothing when the reviewer cancels the rejection', async () => {
      await open(`${PAGE}?tab=workflow`, 'zoro', REVIEWER);
      await answerContent([V1, V2, summary(3, 'IN_REVIEW')], 2);
      await answerOwnVersion('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT']);

      node('REJECTED').click();
      harness.detectChanges();
      rejectDialog().close();
      harness.detectChanges();

      expect(rejectDialog().open).toBe(false);
      httpTesting.expectNone(`${VERSION}/reject`);
    });

    it('shows why a rejected version was rejected, by whom and when', async () => {
      await open(PAGE, 'nami', EDITOR);
      await answerContent([V1, V2, summary(3, 'REJECTED')], 2);
      await answerOwnVersion('REJECTED', ['RETURN_TO_DRAFT'], REASON, [CREATED, REJECTED_BY_ZORO]);

      const banner = root.querySelector('[data-testid="rejection-banner"]')?.textContent ?? '';
      expect(banner).toContain(`Reason for rejection: ${REASON}`);
      expect(banner).toContain('by zoro · 08/20');
    });

    it('takes a rejected version back to draft from the Draft status', async () => {
      await open(`${PAGE}?tab=workflow`, 'nami', EDITOR);
      await answerContent([V1, V2, summary(3, 'REJECTED')], 2);
      await answerOwnVersion('REJECTED', ['RETURN_TO_DRAFT'], REASON, [CREATED, REJECTED_BY_ZORO]);

      expect(node('DRAFT').dataset['state']).toBe('next');
      node('DRAFT').click();
      httpTesting.expectOne(`${VERSION}/return-to-draft`).flush({});
      await afterInteraction();
      await answerReload('DRAFT', ['EDIT', 'DELETE', 'SUBMIT'], REASON);

      expect(mascotSays()).toContain('Back in draft');
      expect(node('DRAFT').getAttribute('aria-current')).toBe('step');
      expect(root.querySelector('[data-testid="rejection-banner"]')).toBeNull();
    });

    const PUBLISHER = ['content:read', 'content:publish', 'content:retire'];

    function confirmDialog(): HTMLDialogElement | null {
      return root.querySelector('app-confirm-dialog dialog');
    }

    /** vivi on v3, ready to publish, with v2 online unless said otherwise. */
    async function openReadyVersion(onlineVersionNumber: number | null = 2): Promise<void> {
      await open(`${PAGE}?tab=workflow`, 'vivi', PUBLISHER);
      const chain = onlineVersionNumber === null ? [] : [V1, V2];
      await answerContent([...chain, summary(3, 'READY_TO_PUBLISH')], onlineVersionNumber);
      await answerOwnVersion('READY_TO_PUBLISH', ['PUBLISH', 'ARCHIVE']);
    }

    it('confirms a publication naming the version it replaces, then shows it online', async () => {
      await openReadyVersion();

      expect(node('PUBLISHED').dataset['state']).toBe('next');
      node('PUBLISHED').click();
      harness.detectChanges();
      expect(confirmDialog()?.open).toBe(true);
      expect(confirmDialog()?.textContent).toContain('Publish "Logia draft"?');
      expect(confirmDialog()?.textContent).toContain(
        'v3 goes online, visible to every reader. v2 becomes "superseded" and stays in the history.',
      );
      httpTesting.expectNone(`${VERSION}/publish`);

      confirmDialog()!.querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')!.click();
      const publish = httpTesting.expectOne(`${VERSION}/publish`);
      expect(publish.request.method).toBe('POST');
      publish.flush({});
      await afterInteraction();
      httpTesting.expectOne(DETAIL).flush({
        id: ID,
        onlineVersionNumber: 3,
        versions: [V1, summary(2, 'SUPERSEDED'), summary(3, 'PUBLISHED')],
      });
      await afterInteraction();
      await answerOwnVersion('PUBLISHED', ['RETIRE']);

      expect(confirmDialog()).toBeNull();
      expect(mascotSays()).toBe('Published! v3 is online.');
      expect(root.querySelector('[aria-current="step"]')?.getAttribute('data-status')).toBe(
        'PUBLISHED',
      );
    });

    it('replaces nothing when no version is online', async () => {
      await openReadyVersion(null);

      node('PUBLISHED').click();
      harness.detectChanges();

      expect(confirmDialog()?.textContent).toContain('v3 goes online, visible to every reader.');
      expect(confirmDialog()?.textContent).not.toContain('superseded');
    });

    it('publishes nothing when the publisher cancels', async () => {
      await openReadyVersion();

      node('PUBLISHED').click();
      harness.detectChanges();
      confirmDialog()!.close();
      harness.detectChanges();

      expect(confirmDialog()).toBeNull();
      httpTesting.expectNone(`${VERSION}/publish`);
    });

    describe('as an administrator', () => {
      const ADMIN = [
        ...EDITOR,
        'content:review',
        'content:publish',
        'content:retire',
        'content:admin',
      ];
      const ZORO = { id: 'u3', username: 'zoro', email: 'zoro@onepiece.local' };
      const LUFFY = { id: 'u9', username: 'luffy', email: 'luffy@onepiece.local' };

      /** luffy on v3, by `author`, offered `allowedActions` - those in `overrideActions` only as an administrator. */
      async function openAsAdmin(
        status: VersionStatus,
        allowedActions: string[],
        overrideActions: string[],
        { author = NAMI, claimant = null as typeof ZORO | null } = {},
      ): Promise<void> {
        await open(`${PAGE}?tab=workflow`, 'luffy', ADMIN);
        await answerContent([V1, V2, summary(3, status, author)], 2);
        httpTesting.expectOne(VERSION).flush({
          ...summary(3, status, author),
          claimant,
          rejectionReason: null,
          body: body('Logia draft'),
          allowedActions,
          overrideActions,
        });
        httpTesting.expectOne(`${VERSION}/events`).flush([CREATED]);
        await harness.fixture.whenStable();
        harness.detectChanges();
      }

      function confirmOverride(): void {
        confirmDialog()!
          .querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')!
          .click();
      }

      it('confirms editing someone else’s draft, naming its author, then opens the editor', async () => {
        const ownActions = ['EDIT', 'DELETE', 'SUBMIT'];
        await openAsAdmin('DRAFT', ownActions, ownActions);

        node('DRAFT').click();
        harness.detectChanges();
        expect(confirmDialog()?.textContent).toContain("Act in nami's place?");
        expect(confirmDialog()?.textContent).toContain("You open nami's draft v3 for editing.");
        expect(TestBed.inject(Router).url).not.toContain('/edit');

        confirmOverride();
        await afterInteraction();

        expect(TestBed.inject(Router).url).toBe(`${PAGE}/edit`);
      });

      it('submits nothing when the administrator cancels', async () => {
        const ownActions = ['EDIT', 'DELETE', 'SUBMIT'];
        await openAsAdmin('DRAFT', ownActions, ownActions);

        node('IN_REVIEW').click();
        harness.detectChanges();
        expect(confirmDialog()?.textContent).toContain("You submit nami's v3 for review");
        confirmDialog()!.close();
        harness.detectChanges();

        expect(confirmDialog()).toBeNull();
        httpTesting.expectNone(`${VERSION}/submit`);
      });

      it('confirms releasing the review someone else holds, naming them, then frees it', async () => {
        await openAsAdmin('IN_REVIEW', ['RELEASE'], ['RELEASE'], { claimant: ZORO });

        node('IN_REVIEW').click();
        harness.detectChanges();
        expect(confirmDialog()?.textContent).toContain('You take v3 away from zoro');
        httpTesting.expectNone(`${VERSION}/release`);

        confirmOverride();
        httpTesting.expectOne(`${VERSION}/release`).flush({});
        await afterInteraction();
        await answerReload('IN_REVIEW', ['CLAIM']);

        expect(confirmDialog()).toBeNull();
        expect(mascotSays()).toContain('Released');
      });

      it('pulls back someone else’s version, then says whose draft it is again', async () => {
        await openAsAdmin('IN_REVIEW', ['PULL_BACK'], ['PULL_BACK']);

        node('DRAFT').click();
        harness.detectChanges();
        confirmOverride();
        httpTesting.expectOne(`${VERSION}/pull-back`).flush({});
        await afterInteraction();
        await answerReload('DRAFT', []);

        expect(mascotSays()).toContain("it is nami's draft again");
      });

      it('claims their own version at once, with no confirmation', async () => {
        await openAsAdmin('IN_REVIEW', ['PULL_BACK', 'CLAIM'], ['CLAIM'], { author: LUFFY });

        node('IN_REVIEW').click();
        harness.detectChanges();

        expect(confirmDialog()).toBeNull();
        httpTesting.expectOne(`${VERSION}/claim`).flush({});
        await afterInteraction();
        await answerReload('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT']);
      });
    });

    it('confirms an archiving in its own color, replacing nothing, then shows it archived', async () => {
      await openReadyVersion();

      expect(node('ARCHIVED').dataset['state']).toBe('next');
      node('ARCHIVED').click();
      harness.detectChanges();
      expect(confirmDialog()?.textContent).toContain('Archive "Logia draft"?');
      expect(confirmDialog()?.textContent).toContain('v3 stays approved but is not published');
      expect(confirmDialog()?.textContent).not.toContain('superseded');
      const action = confirmDialog()!.querySelector<HTMLButtonElement>(
        '[data-testid="confirm-action"]',
      )!;
      expect(action.className).toContain('bg-status-archived-ink');
      httpTesting.expectNone(`${VERSION}/archive`);

      action.click();
      const archive = httpTesting.expectOne(`${VERSION}/archive`);
      expect(archive.request.method).toBe('POST');
      archive.flush({});
      await afterInteraction();
      await answerReload('ARCHIVED', ['RECOVER']);

      expect(confirmDialog()).toBeNull();
      expect(mascotSays()).toBe('Archived. Recover it from the Workflow whenever you need it.');
      expect(TestBed.inject(MascotService).message().tone).toBe('info');
      expect(node('READY_TO_PUBLISH').dataset['state']).toBe('next');
    });

    it('recovers an archived version from the Ready to publish status, with no confirmation', async () => {
      await open(`${PAGE}?tab=workflow`, 'vivi', PUBLISHER);
      await answerContent([V1, V2, summary(3, 'ARCHIVED')], 2);
      await answerOwnVersion('ARCHIVED', ['RECOVER']);

      node('READY_TO_PUBLISH').click();
      harness.detectChanges();
      expect(confirmDialog()).toBeNull();
      httpTesting.expectOne(`${VERSION}/recover`).flush({});
      await afterInteraction();
      await answerReload('READY_TO_PUBLISH', ['PUBLISH', 'ARCHIVE']);

      expect(mascotSays()).toBe('Recovered: it is ready to publish again.');
      expect(root.querySelector('[aria-current="step"]')?.getAttribute('data-status')).toBe(
        'READY_TO_PUBLISH',
      );
    });

    it('offers no recovery while the content has another open version', async () => {
      await open(`${PAGE}?tab=workflow`, 'vivi', PUBLISHER);
      await answerContent([V1, V2, summary(3, 'ARCHIVED')], 2);
      await answerOwnVersion('ARCHIVED', []);

      expect(
        root.querySelector('[data-status="READY_TO_PUBLISH"]')?.getAttribute('data-state'),
      ).toBe('idle');
      expect(node('READY_TO_PUBLISH')).toBeNull();
    });

    it('confirms a retirement in its own color, then shows the version offline', async () => {
      await open(`${PAGE}?tab=workflow`, 'vivi', PUBLISHER);
      await answerContent([V1, summary(2, 'SUPERSEDED'), summary(3, 'PUBLISHED')], 3);
      await answerOwnVersion('PUBLISHED', ['RETIRE']);

      expect(node('RETIRED').dataset['state']).toBe('next');
      node('RETIRED').click();
      harness.detectChanges();
      expect(confirmDialog()?.textContent).toContain('Retire v3 from publication?');
      expect(confirmDialog()?.textContent).toContain('Readers will no longer see it.');
      const action = confirmDialog()!.querySelector<HTMLButtonElement>(
        '[data-testid="confirm-action"]',
      )!;
      expect(action.className).toContain('bg-status-retired-ink');
      httpTesting.expectNone(`${VERSION}/retire`);

      action.click();
      const retire = httpTesting.expectOne(`${VERSION}/retire`);
      expect(retire.request.method).toBe('POST');
      retire.flush({});
      await afterInteraction();
      await answerReload('RETIRED', ['RESTORE']);

      expect(confirmDialog()).toBeNull();
      expect(mascotSays()).toBe('Retired from publication. The version history stays intact.');
      expect(TestBed.inject(MascotService).message().tone).toBe('info');
      expect(node('PUBLISHED').dataset['state']).toBe('next');
    });

    it('confirms a republication naming the version it replaces, then says both', async () => {
      await open(`${PAGE}?tab=workflow`, 'vivi', PUBLISHER);
      await answerContent([summary(1, 'PUBLISHED'), V2, summary(3, 'SUPERSEDED')], 1);
      await answerOwnVersion('SUPERSEDED', ['RESTORE']);

      expect(node('PUBLISHED').dataset['state']).toBe('next');
      node('PUBLISHED').click();
      harness.detectChanges();
      expect(confirmDialog()?.textContent).toContain('Republish v3?');
      expect(confirmDialog()?.textContent).toContain(
        'v3 goes back online exactly as it was. v1, online today, becomes "superseded" and stays in the history.',
      );
      expect(confirmDialog()?.textContent).toContain('No new version is created');

      confirmDialog()!.querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')!.click();
      httpTesting.expectOne(`${VERSION}/restore`).flush({});
      await afterInteraction();
      httpTesting.expectOne(DETAIL).flush({
        id: ID,
        onlineVersionNumber: 3,
        versions: [summary(1, 'SUPERSEDED'), V2, summary(3, 'PUBLISHED')],
      });
      await afterInteraction();
      await answerOwnVersion('PUBLISHED', ['RETIRE']);

      expect(mascotSays()).toBe('v3 is back online. v1 is now superseded.');
      expect(TestBed.inject(MascotService).message().tone).toBe('success');
    });

    it('republishes a retired version replacing nothing when nothing is online', async () => {
      await open(`${PAGE}?tab=workflow`, 'vivi', PUBLISHER);
      await answerContent([V1, summary(2, 'SUPERSEDED'), summary(3, 'RETIRED')], null);
      await answerOwnVersion('RETIRED', ['RESTORE']);

      node('PUBLISHED').click();
      harness.detectChanges();
      expect(confirmDialog()?.textContent).toContain('v3 goes back online exactly as it was.');
      expect(confirmDialog()?.textContent).not.toContain('superseded');

      confirmDialog()!.querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')!.click();
      httpTesting.expectOne(`${VERSION}/restore`).flush({});
      await afterInteraction();
      await answerReload('PUBLISHED', ['RETIRE']);

      expect(mascotSays()).toBe('v3 is back online.');
    });
  });

  describe('opening a new version', () => {
    const VERSIONS = `${DETAIL}/versions`;

    /** chopper on a closed version of nami's, which he may open a new draft from. */
    async function openClosedVersion(
      chain: ReturnType<typeof summary>[],
      onlineVersionNumber: number | null,
      shown: ReturnType<typeof summary>,
    ): Promise<void> {
      await open(`${PAGE}?v=${shown.number}&tab=workflow`, 'chopper', EDITOR);
      await answerContent(chain, onlineVersionNumber);
      const url = `${VERSIONS}/${shown.number}`;
      httpTesting.expectOne(url).flush({
        ...shown,
        rejectionReason: null,
        body: body('Logia'),
        allowedActions: ['OPEN_NEW_VERSION'],
      });
      httpTesting.expectOne(`${url}/events`).flush([]);
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    function draftNode(): HTMLButtonElement {
      return root.querySelector<HTMLButtonElement>(
        'button[data-testid="route-node"][data-status="DRAFT"]',
      )!;
    }

    function mascotSays(): string {
      return TestBed.inject(MascotService).message().text;
    }

    it('opens the next version from the one on screen, then its editor', async () => {
      await openClosedVersion([V1, V2], 2, V2);

      draftNode().click();
      const opening = httpTesting.expectOne(VERSIONS);
      expect(opening.request.method).toBe('POST');
      expect(opening.request.body).toEqual({ basedOn: 2 });
      opening.flush({
        ...summary(3, 'DRAFT', CHOPPER),
        rejectionReason: null,
        body: body('Logia'),
        allowedActions: ['EDIT', 'DELETE', 'SUBMIT'],
      });
      await afterInteraction();

      expect(TestBed.inject(Router).url).toBe(`${PAGE}/edit`);
      expect(mascotSays()).toBe(
        'New draft v3 from v2, in your name. v2 stays online until this one is published.',
      );
    });

    it('says which version stays online when the base is an older one', async () => {
      await openClosedVersion([V1, V2], 2, V1);

      draftNode().click();
      expect(httpTesting.expectOne(VERSIONS).request.body).toEqual({ basedOn: 1 });
    });

    it('says an archived base stays in the history', async () => {
      const archived = summary(1, 'ARCHIVED');
      await openClosedVersion([archived], null, archived);

      draftNode().click();
      httpTesting.expectOne(VERSIONS).flush({
        ...summary(2, 'DRAFT', CHOPPER),
        rejectionReason: null,
        body: body('Logia'),
        allowedActions: ['EDIT', 'DELETE', 'SUBMIT'],
      });
      await afterInteraction();

      expect(mascotSays()).toBe('New draft v2 from the archived v1, which stays in the history.');
    });

    it('stays on the content as it now is when another editor opened one first', async () => {
      await openClosedVersion([V1, V2], 2, V2);

      draftNode().click();
      httpTesting
        .expectOne(VERSIONS)
        .flush(
          { errorCode: 'CONTENT_VERSION_ACTION_CONFLICT' },
          { status: 409, statusText: 'Conflict' },
        );
      await afterInteraction();
      httpTesting
        .expectOne(DETAIL)
        .flush({ id: ID, onlineVersionNumber: 2, versions: [V1, V2, V3] });
      await afterInteraction();
      httpTesting
        .expectOne(`${VERSIONS}/2`)
        .flush({ ...V2, rejectionReason: null, body: body('Logia'), allowedActions: [] });
      httpTesting.expectOne(`${VERSIONS}/2/events`).flush([]);
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(mascotSays()).toContain('changed in the meantime');
      expect(TestBed.inject(Router).url).toBe(`${PAGE}?v=2&tab=workflow`);
      expect(draftNode()).toBeNull();
    });
  });

  describe('comparing versions', () => {
    /** v3, a draft opened again from v1 - not from v2, the previous one. */
    const V3_FROM_V1 = { ...summary(3, 'DRAFT', CHOPPER), basedOn: 1 };

    const FIRST = {
      romaji: 'Rogia',
      translations: {
        it: { name: 'Rogia', description: 'Frutti elementali.' },
        en: { name: 'Logia', description: null },
      },
    };
    const ONLINE = {
      romaji: 'Rogia',
      translations: {
        it: { name: 'Rogia', description: 'Frutti che trasformano il corpo.' },
        en: { name: 'Logia', description: 'Fruits that turn the body.' },
      },
    };
    const DRAFT = {
      romaji: 'Rogia',
      translations: {
        it: { name: 'Rogia', description: 'Frutti elementali, i più rari.' },
        en: { name: null, description: 'Elemental fruits.' },
      },
    };

    function panel(): HTMLElement {
      return root.querySelector('app-devil-fruit-type-comparison') as HTMLElement;
    }

    function panelOpen(): boolean {
      return panel().querySelector('dialog')!.hasAttribute('open');
    }

    function compareButton(): HTMLButtonElement {
      return root.querySelector<HTMLButtonElement>('[data-testid="compare-versions"]')!;
    }

    /** "Name · EN − removed"…: the changed rows, as label and change. */
    function rows(): string[] {
      return Array.from(panel().querySelectorAll('[data-testid="comparison-row"]')).map((row) =>
        Array.from(row.firstElementChild?.children ?? [])
          .map((part) => part.textContent?.replace(/\s+/g, ' ').trim())
          .join(' '),
      );
    }

    function summaryText(): string {
      const summary = panel().querySelector('[data-testid="comparison-summary"]');
      return summary?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }

    function baseSelect(): HTMLSelectElement | null {
      return panel().querySelector<HTMLSelectElement>('[data-testid="comparison-base"]');
    }

    function panelTab(label: string): HTMLButtonElement {
      return Array.from(panel().querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
        (candidate) => candidate.textContent?.includes(label),
      )!;
    }

    /** Answers what the panel reads of a version - nothing else of it is asked. */
    async function answerPanel(version: ReturnType<typeof summary>, versionBody: object) {
      httpTesting
        .expectOne(`${DETAIL}/versions/${version.number}`)
        .flush({ ...version, rejectionReason: null, body: versionBody, allowedActions: [] });
      await afterInteraction();
    }

    /** nami on v3, the draft chopper opened from v1, with v2 online. */
    async function openOnDraft(): Promise<void> {
      await open(PAGE, 'nami', EDITOR);
      await answerContent([V1, V2, V3_FROM_V1], 2);
      await answerVersion(V3_FROM_V1, DRAFT);
    }

    /** Opens the panel on v3 and answers its two versions: v3 and its default base, v1. */
    async function compareDraft(): Promise<void> {
      await openOnDraft();
      compareButton().click();
      await afterInteraction();
      await answerPanel(V3_FROM_V1, DRAFT);
      await answerPanel(V1, FIRST);
    }

    it('offers to compare with the version it was opened from', async () => {
      await openOnDraft();

      expect(compareButton().textContent?.trim()).toBe('± Compare with v1');
      expect(panelOpen()).toBe(false);
    });

    it('offers to see the fields of the first version', async () => {
      await open(`${PAGE}?v=1`, 'nami', EDITOR);
      await answerContent([V1, V2, V3_FROM_V1], 2);
      await answerVersion(V1, FIRST);

      expect(compareButton().textContent?.trim()).toBe('± See the fields');
    });

    it('compares with the based-on version by default, changed fields only', async () => {
      await compareDraft();

      expect(panelOpen()).toBe(true);
      expect(panel().textContent).toContain('Comparing v1 → v3');
      expect(baseSelect()?.value).toBe('1');
      expect(Array.from(baseSelect()!.options).map((option) => option.value)).toEqual(['2', '1']);
      expect(summaryText()).toBe('+ 1 added − 1 removed ~ 1 modified = 2 unchanged');
      expect(rows()).toEqual([
        'Name · EN − removed',
        'Description · IT ~ modified',
        'Description · EN + added',
      ]);
      expect(panel().querySelector('[data-testid="comparison-unchanged"]')).toBeNull();
      expect(TestBed.inject(Router).url).toBe(PAGE);
    });

    it('lists the unchanged fields on request', async () => {
      await compareDraft();

      const toggle = panel().querySelector<HTMLButtonElement>(
        '[data-testid="comparison-toggle-unchanged"]',
      )!;
      expect(toggle.textContent).toContain('Show 2 unchanged fields');
      toggle.click();
      harness.detectChanges();

      const unchanged = panel().querySelector('[data-testid="comparison-unchanged"]');
      expect(unchanged?.textContent).toContain('Romaji');
      expect(unchanged?.textContent).toContain('Name · IT');
      expect(toggle.textContent).toContain('Hide 2 unchanged fields');
    });

    it('compares with another earlier version once picked', async () => {
      await compareDraft();

      const select = baseSelect()!;
      select.value = '2';
      select.dispatchEvent(new Event('change'));
      await afterInteraction();
      await answerPanel(V2, ONLINE);

      expect(panel().textContent).toContain('Comparing v2 → v3');
      expect(summaryText()).toBe('+ 0 added − 1 removed ~ 2 modified = 2 unchanged');
    });

    it('compares the first version with an empty content', async () => {
      await open(`${PAGE}?v=1`, 'nami', EDITOR);
      await answerContent([V1, V2, V3_FROM_V1], 2);
      await answerVersion(V1, FIRST);

      compareButton().click();
      await afterInteraction();
      await answerPanel(V1, FIRST);

      expect(baseSelect()).toBeNull();
      expect(panel().textContent).toContain('nothing existed before v1');
      expect(panel().textContent).toContain('First version');
      expect(summaryText()).toBe('+ 4 added − 0 removed ~ 0 modified = 0 unchanged');
    });

    it('moves along the chain inside the panel, back to the default base, URL untouched', async () => {
      await compareDraft();

      const v2 = Array.from(
        panel().querySelectorAll<HTMLButtonElement>('[data-testid="version-link"]'),
      ).find((link) => link.textContent?.includes('v2'))!;
      v2.click();
      await afterInteraction();
      await answerPanel(V2, ONLINE);
      // v1 is the base again: already loaded, it is not asked for twice.

      expect(panel().textContent).toContain('Comparing v1 → v2');
      expect(baseSelect()?.value).toBe('1');
      expect(TestBed.inject(Router).url).toBe(PAGE);
      expect(selectedBar()).toContain('v3 · Draft');
    });

    it('shows the whole card, and starts from the changes again when reopened', async () => {
      await compareDraft();

      panelTab('Full card').click();
      harness.detectChanges();
      expect(panel().querySelector('app-devil-fruit-type-card')).not.toBeNull();
      expect(rows()).toEqual([]);

      panel().querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
      await afterInteraction();
      expect(panelOpen()).toBe(false);

      compareButton().click();
      await afterInteraction();
      await answerPanel(V3_FROM_V1, DRAFT);
      await answerPanel(V1, FIRST);

      expect(panelOpen()).toBe(true);
      expect(panelTab('Changes').getAttribute('aria-selected')).toBe('true');
      expect(panel().querySelector('app-devil-fruit-type-card')).toBeNull();
    });

    it('says when a version cannot be loaded', async () => {
      await openOnDraft();
      compareButton().click();
      await afterInteraction();
      await answerPanel(V3_FROM_V1, DRAFT);
      httpTesting
        .expectOne(`${DETAIL}/versions/1`)
        .flush('nope', { status: 500, statusText: 'Error' });
      await afterInteraction();

      expect(panel().textContent).toContain('could not be loaded');
    });
  });
});
