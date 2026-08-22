import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminUserList } from './user-list';

describe('AdminUserList', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists users with their status and roles', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();

    httpTesting.expectOne('/api/admin/users?page=0').flush({
      content: [{ userId: '1', email: 'luffy@onepiece.local', status: 'ACTIVE', roles: ['ADMIN'] }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('luffy@onepiece.local');
    expect(root.textContent).toContain('Active');
    expect(root.textContent).toContain('ADMIN');
    expect(root.textContent).toContain('1–1 of 1');
  });

  it('shows an error toast message when the request fails', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/admin/users?page=0')
      .flush('nope', { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Lost the manifest');
  });
});
