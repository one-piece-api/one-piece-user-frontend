import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { DashboardHome } from './dashboard-home';
import type { Activity, Dashboard } from './dashboard.model';

const EDITOR_DASHBOARD: Dashboard = {
  statuses: [
    { status: 'DRAFT', count: 3, mine: 2 },
    { status: 'IN_REVIEW', count: 1, mine: null },
    { status: 'REJECTED', count: 0, mine: null },
    { status: 'PUBLISHED', count: 5, mine: null },
  ],
};

const PUBLISHED: Activity = {
  action: 'VERSION_PUBLISHED',
  occurredAt: '2026-08-20T10:00:00Z',
  entityType: 'DEVIL_FRUIT_TYPE',
  contentId: 'c1',
  versionNumber: 2,
  label: 'Logia',
  title: { names: { en: 'Logia', it: 'Rogia' }, fallback: 'Shizen-kei' },
};

const REJECTED_UNSEEN: Activity = {
  action: 'VERSION_REJECTED',
  occurredAt: '2026-08-20T09:00:00Z',
  entityType: 'DEVIL_FRUIT_TYPE',
  contentId: 'c2',
  versionNumber: 1,
  label: 'Mythic',
  title: null,
};

describe('DashboardHome', () => {
  let fixture: ComponentFixture<DashboardHome>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHome, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardHome);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: ['EDITOR', 'REVIEWER'],
      permissions: ['content:read', 'content:write'],
    });
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function answer(dashboard: Dashboard | null, activity: Activity[] | null): Promise<void> {
    const tiles = httpTesting.expectOne('/api/content/dashboard');
    const latest = httpTesting.expectOne('/api/content/dashboard/activity');
    if (dashboard) {
      tiles.flush(dashboard);
    } else {
      tiles.flush('nope', { status: 500, statusText: 'Error' });
    }
    if (activity) {
      latest.flush(activity);
    } else {
      latest.flush('nope', { status: 500, statusText: 'Error' });
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function tiles(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="dashboard-tile"]'));
  }

  function rows(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="activity-row"]'));
  }

  it('greets the caller, with their roles on top', async () => {
    await answer(EDITOR_DASHBOARD, []);

    expect(root.textContent).toContain('Dashboard · EDITOR · REVIEWER');
    expect(root.querySelector('h1')?.textContent).toContain('nami');
    expect(root.querySelector('img[src="assets/logpose.webp"]')).not.toBeNull();
  });

  it('shows one tile per status it receives, in that order, with its count', async () => {
    await answer(EDITOR_DASHBOARD, []);

    expect(tiles().map((tile) => tile.dataset['status'])).toEqual([
      'DRAFT',
      'IN_REVIEW',
      'REJECTED',
      'PUBLISHED',
    ]);
    expect(
      tiles().map((tile) => tile.querySelector('[data-testid="tile-count"]')?.textContent),
    ).toEqual(['3', '1', '0', '5']);
    expect(tiles()[0].textContent).toContain('Draft');
  });

  it('tags the caller’s share only where they have one', async () => {
    await answer(EDITOR_DASHBOARD, []);

    const tags = tiles().map(
      (tile) => tile.querySelector('[data-testid="tile-mine"]')?.textContent?.trim() ?? null,
    );
    expect(tags).toEqual(['2 yours', null, null, null]);
  });

  it('fades a tile with nothing in it', async () => {
    await answer(EDITOR_DASHBOARD, []);

    expect(tiles()[2].classList).toContain('opacity-60');
    expect(tiles()[0].classList).not.toContain('opacity-60');
  });

  it('lists the caller’s latest actions, linking the contents they still see', async () => {
    await answer(EDITOR_DASHBOARD, [PUBLISHED, REJECTED_UNSEEN]);

    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('You published');
    expect(rows()[0].textContent).toContain('v2');
    const link = rows()[0].querySelector<HTMLAnchorElement>('[data-testid="activity-link"]');
    expect(link?.textContent?.trim()).toBe('Logia');
    expect(link?.getAttribute('href')).toBe('/content/devil-fruit-types/c1');
    expect(rows()[1].textContent).toContain('You rejected');
    expect(rows()[1].textContent).toContain('Mythic');
    expect(rows()[1].querySelector('[data-testid="activity-link"]')).toBeNull();
  });

  it('says when the caller has done nothing yet', async () => {
    await answer(EDITOR_DASHBOARD, []);

    expect(root.querySelector('[data-testid="activity-empty"]')?.textContent).toContain(
      'No activity recorded under your name',
    );
  });

  it('keeps the activity when the counters cannot be loaded', async () => {
    await answer(null, [PUBLISHED]);

    expect(root.textContent).toContain('The dashboard could not be loaded');
    expect(tiles()).toHaveLength(0);
    expect(rows()).toHaveLength(1);
  });

  it('keeps the counters when the activity cannot be loaded', async () => {
    await answer(EDITOR_DASHBOARD, null);

    expect(tiles()).toHaveLength(4);
    expect(root.textContent).toContain('Your latest activity could not be loaded');
  });
});
