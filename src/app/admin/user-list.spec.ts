import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Modal } from '../shared/ui/modal';
import { AdminUserList } from './user-list';

// jsdom doesn't implement <dialog>'s showModal()/close() yet - every real browser this app
// targets does, so this is purely a test-environment gap, polyfilled here rather than
// worked around in Modal itself.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

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
    expect(root.textContent).toContain('Unable to load the crew manifest');
  });

  it('keeps the invite form hidden until "New User" is selected', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();

    httpTesting.expectOne('/api/admin/users?page=0').flush({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(Modal)).componentInstance as Modal;
    expect(modal.open()).toBe(false);

    const root = fixture.nativeElement as HTMLElement;
    const newUserButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'New User',
    );
    newUserButton!.click();
    fixture.detectChanges();

    expect(modal.open()).toBe(true);
  });
});
