import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Header } from './header';

describe('Header', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows the signed-in email and links Log Out to oauth2-proxy sign_out', async () => {
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({ email: 'luffy@onepiece.local', roles: ['ADMIN'] });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('luffy@onepiece.local');
    const links = Array.from(root.querySelectorAll('a'));
    const logoutLink = links.find((link) =>
      link.getAttribute('href')?.includes('/oauth2/sign_out'),
    );
    expect(logoutLink).toBeDefined();
  });

  it('links to the crew manifest only for an ADMIN', async () => {
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({ email: 'nami@onepiece.local', roles: ['EDITOR'] });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll('a'));
    expect(links.some((link) => link.getAttribute('href') === '/admin/users')).toBe(false);
  });
});
