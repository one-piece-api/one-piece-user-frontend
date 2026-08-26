import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '../shared/toast/toast';
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
      content: [
        {
          userId: '1',
          username: 'luffy',
          email: 'luffy@onepiece.local',
          status: 'ACTIVE',
          roles: ['ADMIN'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('luffy');
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

  it('resends an invitation for an expired invitation', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users?page=0').flush({
      content: [
        {
          userId: '1',
          email: 'usopp@onepiece.local',
          status: 'INVITATION_EXPIRED',
          roles: ['EDITOR'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const resendButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Resend Invitation',
    );
    resendButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/admin/users/1/resend-invitation').flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'Resent the invitation to usopp@onepiece.local!',
        tone: 'success',
      }),
    );

    httpTesting.expectOne('/api/admin/users?page=0').flush({
      content: [
        {
          userId: '1',
          email: 'usopp@onepiece.local',
          status: 'PENDING',
          roles: ['EDITOR'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
  });

  it('shows a themed error toast when the invitation email cannot be delivered', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users?page=0').flush({
      content: [
        {
          userId: '1',
          email: 'usopp@onepiece.local',
          status: 'INVITATION_EXPIRED',
          roles: ['EDITOR'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const resendButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Resend Invitation',
    );
    resendButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/admin/users/1/resend-invitation')
      .flush(
        { detail: 'Could not send the invitation email', errorCode: 'USER_EMAIL_DELIVERY_FAILED' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message:
          'Arrr! Could not resend the invitation to usopp@onepiece.local - the message bird got lost.',
        tone: 'error',
      }),
    );
  });

  it('does not show a resend action for an active user', async () => {
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
    const resendButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Resend Invitation',
    );
    expect(resendButton).toBeUndefined();
  });

  it('links each row to its Step 6 role editor', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();

    httpTesting.expectOne('/api/admin/users?page=0').flush({
      content: [
        {
          userId: '1',
          username: 'luffy',
          email: 'luffy@onepiece.local',
          status: 'ACTIVE',
          roles: ['ADMIN'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const manageRolesLink = Array.from(root.querySelectorAll('a')).find(
      (link) => link.textContent?.trim() === 'Manage Roles',
    );
    expect(manageRolesLink?.getAttribute('href')).toBe('/admin/users/1');
  });

  it('does not show a resend action for a still-pending (not yet expired) user', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();

    httpTesting.expectOne('/api/admin/users?page=0').flush({
      content: [
        { userId: '1', email: 'usopp@onepiece.local', status: 'PENDING', roles: ['EDITOR'] },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const resendButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Resend Invitation',
    );
    expect(resendButton).toBeUndefined();
  });
});
