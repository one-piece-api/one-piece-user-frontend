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
});
