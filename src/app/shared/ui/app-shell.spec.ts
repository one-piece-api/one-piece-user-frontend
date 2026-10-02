import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { MascotService } from '../mascot/mascot';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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
    const links = Array.from(root.querySelectorAll('a'));
    expect(links.some((link) => link.getAttribute('href') === '/roles')).toBe(true);
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
    const links = Array.from(root.querySelectorAll('a'));
    expect(links.some((link) => link.getAttribute('href') === '/audit')).toBe(true);
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
    const hrefs = Array.from(root.querySelectorAll('a')).map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/content/devil-fruit-types');
    expect(root.textContent).toContain('Devil Fruit Types');

    const announced = Array.from(root.querySelectorAll('nav button')).map((button) =>
      Array.from(button.querySelectorAll(':scope > span'))
        .map((part) => part.textContent?.trim())
        .join(' '),
    );
    expect(announced).toEqual([
      '☺ Characters coming soon',
      '◆ Devil Fruits coming soon',
      '⚑ Crews coming soon',
      '≡ Story Arcs coming soon',
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
    (root.querySelector('nav button') as HTMLButtonElement).click();

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
});
