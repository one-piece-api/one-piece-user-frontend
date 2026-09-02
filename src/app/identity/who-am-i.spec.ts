import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { WhoAmI } from './who-am-i';

describe('WhoAmI', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhoAmI, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows the username and roles returned by /api/me', async () => {
    const fixture = TestBed.createComponent(WhoAmI);
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/me')
      .flush({ username: 'luffy', email: 'luffy@onepiece.local', roles: ['ADMIN'] });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('luffy');
    expect(root.textContent).toContain('luffy@onepiece.local');
    expect(root.textContent).toContain('ADMIN');
  });

  it('shows an error state when the identity request fails', async () => {
    const fixture = TestBed.createComponent(WhoAmI);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush('nope', { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Lost at sea');
  });

  it('links "Delete My Account" straight to the Keycloak account client - no confirmation modal, no backend call', async () => {
    const fixture = TestBed.createComponent(WhoAmI);
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/me')
      .flush({ username: 'luffy', email: 'luffy@onepiece.local', roles: ['ADMIN'] });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const link = Array.from(root.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Delete My Account'),
    ) as HTMLAnchorElement;

    expect(link).toBeTruthy();
    const href = link.getAttribute('href') ?? '';
    // Clears the oauth2-proxy session before Keycloak is even reached (see
    // startAccountDeletionUrl() in auth-urls.ts) - the actual Keycloak
    // account-client URL is the "rd" target of that sign-out, not the href itself.
    expect(href.startsWith('/oauth2/sign_out?rd=')).toBe(true);
    const target = decodeURIComponent(href.slice('/oauth2/sign_out?rd='.length));
    expect(target).toContain('kc_action=delete_account');
    expect(target).toContain('client_id=account');
  });
});
