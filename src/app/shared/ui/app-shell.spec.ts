import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { MascotService } from '../mascot/mascot';
import { AppShell } from './app-shell';

@Component({ template: '' })
class BlankPage {}

/** The sidebar entry that opens a group of sections, found by its label. */
function groupButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('nav button')).find(
    (candidate) => candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`No sidebar group "${label}"`);
  return button;
}

function flyout(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-nav-flyout]');
}

function hrefsIn(element: Element | null): (string | null)[] {
  return Array.from(element?.querySelectorAll('a') ?? []).map((link) => link.getAttribute('href'));
}

function hover(element: Element, pointerType: string): void {
  element.dispatchEvent(new PointerEvent('pointerenter', { pointerType }));
}

describe('AppShell', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell, provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'profile', component: BlankPage },
          { path: 'dashboard', component: BlankPage },
          { path: 'users', component: BlankPage },
        ]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows the signed-in username and links Log Out to oauth2-proxy sign_out', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'luffy',
      email: 'luffy@onepiece.local',
      roles: ['ADMIN'],
      permissions: ['users:read'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('luffy');
    const links = Array.from(root.querySelectorAll('a'));
    const logoutLink = links.find((link) =>
      link.getAttribute('href')?.includes('/oauth2/sign_out'),
    );
    expect(logoutLink).toBeDefined();
  });

  it('keeps a top bar in sight on small screens, with who is signed in', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: ['EDITOR', 'REVIEWER'],
      permissions: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const topBar = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.sticky')!;
    expect(topBar.classList).toContain('top-0');
    expect(topBar.textContent).toContain('nami');
    expect(topBar.textContent).toContain('EDITOR · REVIEWER');
    expect(topBar.textContent).toContain('NA');
  });

  it('links to the crew manifest only when the caller has users:read', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: ['EDITOR'],
      permissions: ['docs:read', 'docs:write'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll('a'));
    expect(links.some((link) => link.getAttribute('href') === '/users')).toBe(false);
    expect(links.some((link) => link.getAttribute('href') === '/audit')).toBe(false);
    expect(links.some((link) => link.getAttribute('href') === '/roles')).toBe(false);
  });

  it('links to roles & permissions only when the caller has roles:manage', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'luffy',
      email: 'luffy@onepiece.local',
      roles: ['ADMIN'],
      permissions: ['users:read', 'roles:read', 'roles:manage'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    groupButton(root, 'Admin').click();
    fixture.detectChanges();
    expect(hrefsIn(flyout(root))).toEqual(['/users', '/roles']);
  });

  it("links to the ship's log only when the caller has audit:read", async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'luffy',
      email: 'luffy@onepiece.local',
      roles: ['ADMIN'],
      permissions: ['users:read', 'audit:read'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    groupButton(root, 'Admin').click();
    fixture.detectChanges();
    expect(hrefsIn(flyout(root))).toEqual(['/users', '/audit']);
  });

  it('lists the content section, with the entities not built yet only announced', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'zoro',
      email: 'zoro@onepiece.local',
      roles: ['REVIEWER'],
      permissions: ['content:read', 'content:review'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    groupButton(root, 'Contents').click();
    fixture.detectChanges();
    const panel = flyout(root);
    expect(hrefsIn(panel)).toEqual(['/content/devil-fruit-types']);
    expect(panel?.textContent).toContain('Devil Fruit Types');
    expect(panel?.textContent).toContain('1 section open');

    const announced = Array.from(panel?.querySelectorAll('button') ?? []).map((button) =>
      Array.from(button.querySelectorAll(':scope > span'))
        .map((part) => part.textContent?.trim())
        .join(' '),
    );
    expect(announced).toEqual([
      'Characters coming soon',
      'Devil Fruits coming soon',
      'Crews coming soon',
    ]);
  });

  it('hides the content section from who lacks content:read', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'luffy',
      email: 'luffy@onepiece.local',
      roles: ['ADMIN'],
      permissions: ['users:read'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toContain('Contents');
    expect(root.querySelectorAll('nav button').length).toBe(0);
  });

  it('lets the mascot say an announced section is not open yet', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({
      username: 'zoro',
      email: 'zoro@onepiece.local',
      roles: ['REVIEWER'],
      permissions: ['content:read'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    groupButton(root, 'Contents').click();
    fixture.detectChanges();
    (flyout(root)?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(flyout(root)).toBeNull();
    const mascot = TestBed.inject(MascotService);
    expect(mascot.open()).toBe(true);
    expect(mascot.message().text).toContain("Characters isn't open yet");
  });

  it('opens and closes the mobile drawer', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'luffy',
      email: 'luffy@onepiece.local',
      roles: ['ADMIN'],
      permissions: ['users:read'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const aside = root.querySelector('aside') as HTMLElement;
    expect(aside.className).toContain('-translate-x-full');
    expect(root.querySelector('[aria-label="Close menu"].fixed.inset-0')).toBeNull();

    (root.querySelector('[aria-label="Open menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(aside.className).not.toContain('-translate-x-full');
    expect(root.querySelector('[aria-label="Close menu"].fixed.inset-0')).not.toBeNull();

    (root.querySelector('[aria-label="Close menu"].fixed.inset-0') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(aside.className).toContain('-translate-x-full');
  });
  describe('sidebar groups', () => {
    async function signIn(permissions: string[]) {
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();
      httpTesting.expectOne('/api/me').flush({
        username: 'luffy',
        email: 'luffy@onepiece.local',
        roles: ['ADMIN'],
        permissions,
      });
      await fixture.whenStable();
      fixture.detectChanges();
      return { fixture, root: fixture.nativeElement as HTMLElement };
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows a group with a single visible section as that section, not as a group', async () => {
      const { root } = await signIn(['users:read']);

      expect(hrefsIn(root.querySelector('nav'))).toEqual(['/profile', '/users']);
      expect(root.querySelector('nav')?.textContent).not.toContain('Admin');
      expect(root.querySelectorAll('nav button').length).toBe(0);
    });

    it('opens the flyout on mouse hover and closes it shortly after the pointer leaves', async () => {
      const { fixture, root } = await signIn(['users:read', 'audit:read']);
      vi.useFakeTimers();
      const admin = groupButton(root, 'Admin');

      hover(admin, 'mouse');
      fixture.detectChanges();
      expect(flyout(root)).not.toBeNull();
      expect(admin.getAttribute('aria-expanded')).toBe('true');

      admin.dispatchEvent(new PointerEvent('pointerleave'));
      hover(flyout(root) as HTMLElement, 'mouse');
      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      expect(flyout(root)).not.toBeNull();

      (flyout(root) as HTMLElement).dispatchEvent(new PointerEvent('pointerleave'));
      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      expect(flyout(root)).toBeNull();
    });

    it('ignores touch hover, which is followed by a click anyway', async () => {
      const { fixture, root } = await signIn(['users:read', 'audit:read']);

      hover(groupButton(root, 'Admin'), 'touch');
      fixture.detectChanges();

      expect(flyout(root)).toBeNull();
    });

    it('keeps a clicked flyout open until clicked again or a click lands elsewhere', async () => {
      const { fixture, root } = await signIn(['users:read', 'audit:read']);
      vi.useFakeTimers();
      const admin = groupButton(root, 'Admin');

      admin.click();
      admin.dispatchEvent(new PointerEvent('pointerleave'));
      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      expect(flyout(root)).not.toBeNull();

      admin.click();
      fixture.detectChanges();
      expect(flyout(root)).toBeNull();

      admin.click();
      fixture.detectChanges();
      (root.querySelector('main') as HTMLElement).click();
      fixture.detectChanges();
      expect(flyout(root)).toBeNull();
    });

    it('marks the current section and its group with the gold tab', async () => {
      const { fixture, root } = await signIn(['users:read', 'audit:read']);
      await TestBed.inject(Router).navigateByUrl('/users');
      fixture.detectChanges();

      const admin = groupButton(root, 'Admin');
      expect(admin.className).toContain('border-treasure-500');
      const profile = root.querySelector('nav a[href="/profile"]') as HTMLElement;
      expect(profile.className).toContain('border-transparent');

      admin.click();
      fixture.detectChanges();
      const current = flyout(root)?.querySelector('[aria-current="page"]');
      expect(current?.getAttribute('href')).toBe('/users');
      expect(current?.className).toContain('border-treasure-500');
    });

    it('opens the dashboard sections from its group, which leads nowhere by itself', async () => {
      const { fixture, root } = await signIn(['content:read']);
      expect(root.querySelector('nav a[href="/dashboard"]')).toBeNull();

      groupButton(root, 'Dashboard').click();
      fixture.detectChanges();
      const statusPages = hrefsIn(flyout(root));
      expect(statusPages[0]).toBe('/dashboard');
      expect(statusPages.length).toBeGreaterThan(1);
    });

    it('leads to the profile from the user block too, without marking that block as current', async () => {
      const { fixture, root } = await signIn(['users:read']);
      await TestBed.inject(Router).navigateByUrl('/profile');
      fixture.detectChanges();

      const menuEntry = root.querySelector('nav a[href="/profile"]') as HTMLElement;
      expect(menuEntry.getAttribute('aria-current')).toBe('page');
      expect(menuEntry.className).toContain('border-treasure-500');
      for (const testId of ['sidebar-profile-link', 'topbar-profile-link']) {
        const userBlock = root.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
        expect(userBlock.getAttribute('href')).toBe('/profile');
        expect(userBlock.textContent).toContain('luffy');
        expect(userBlock.hasAttribute('aria-current')).toBe(false);
        expect(userBlock.className).not.toContain('treasure');
      }
    });

    it('expands the current group inline for the mobile drawer', async () => {
      const { fixture, root } = await signIn(['users:read', 'audit:read']);
      expect(hrefsIn(root.querySelector('nav'))).toEqual(['/profile']);

      await TestBed.inject(Router).navigateByUrl('/users');
      fixture.detectChanges();

      expect(hrefsIn(root.querySelector('nav'))).toEqual(['/profile', '/users', '/audit']);
    });

    it('collapses the current group inline when the user asks, and expands it again', async () => {
      const { fixture, root } = await signIn(['users:read', 'audit:read']);
      await TestBed.inject(Router).navigateByUrl('/users');
      fixture.detectChanges();
      const admin = groupButton(root, 'Admin');

      admin.click();
      fixture.detectChanges();
      expect(hrefsIn(root.querySelector('nav'))).toEqual(['/profile']);

      admin.click();
      fixture.detectChanges();
      expect(hrefsIn(root.querySelector('nav'))).toEqual(['/profile', '/users', '/audit']);
    });
  });
});
