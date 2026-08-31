import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
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
