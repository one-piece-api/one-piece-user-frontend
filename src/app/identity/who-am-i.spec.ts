import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WhoAmI } from './who-am-i';

describe('WhoAmI', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhoAmI],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows the email and roles returned by /api/me, and links Logout to oauth2-proxy sign_out', async () => {
    const fixture = TestBed.createComponent(WhoAmI);
    fixture.detectChanges();

    httpTesting.expectOne('/api/me').flush({ email: 'luffy@onepiece.local', roles: ['ADMIN'] });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('luffy@onepiece.local');
    expect(root.textContent).toContain('ADMIN');
    expect(root.querySelector('a')?.getAttribute('href')).toContain('/oauth2/sign_out?rd=');
  });
});
