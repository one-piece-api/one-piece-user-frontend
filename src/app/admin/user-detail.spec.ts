import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '../shared/toast/toast';
import { AdminUserDetail } from './user-detail';

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

describe('AdminUserDetail', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserDetail],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createWithUserId(userId: string) {
    const fixture = TestBed.createComponent(AdminUserDetail);
    fixture.componentRef.setInput('userId', userId);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the crewmate identity, status and current roles', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('nami');
    expect(root.textContent).toContain('nami@onepiece.local');
    expect(root.textContent).toContain('Active');
    expect(root.textContent).toContain('EDITOR');
  });

  it('shows Grant for a role the crewmate does not hold and Revoke for one it does', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Grant');
    expect(buttons).toContain('Revoke');
  });

  it('grants a role and reloads the crewmate', async () => {
    const fixture = createWithUserId('1');
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const grantButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Grant',
    );
    grantButton!.click();
    fixture.detectChanges();

    const putRequest = httpTesting.expectOne('/api/admin/users/1/roles/ADMIN');
    expect(putRequest.request.method).toBe('PUT');
    putRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({ message: 'Granted ADMIN to nami!', tone: 'success' }),
    );

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR', 'ADMIN'],
    });
  });

  it('revokes a role and reloads the crewmate', async () => {
    const fixture = createWithUserId('1');
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke',
    );
    revokeButton!.click();
    fixture.detectChanges();

    const deleteRequest = httpTesting.expectOne('/api/admin/users/1/roles/EDITOR');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({ message: 'Revoked EDITOR from nami!', tone: 'success' }),
    );

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: [],
    });
  });

  it('shows a themed error toast when revoking would leave zero administrators', async () => {
    const fixture = createWithUserId('1');
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'luffy',
      email: 'luffy@onepiece.local',
      status: 'ACTIVE',
      roles: ['ADMIN'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke',
    );
    revokeButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/admin/users/1/roles/ADMIN')
      .flush(
        { detail: 'Cannot remove the ADMIN role', errorCode: 'USER_LAST_ADMINISTRATOR' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        tone: 'error',
      }),
    );
  });

  it('shows a themed error toast when revoking would leave the crewmate with no roles', async () => {
    const fixture = createWithUserId('1');
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke',
    );
    revokeButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/admin/users/1/roles/EDITOR')
      .flush(
        { detail: 'Cannot remove the EDITOR role', errorCode: 'USER_LAST_ROLE' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'Arrr! nami needs at least one role - grant another before revoking this one.',
        tone: 'error',
      }),
    );
  });

  it('shows Revoke Access for an active crewmate and Reactivate for a disabled one', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    let root = fixture.nativeElement as HTMLElement;
    let buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Revoke Access');
    expect(buttons).not.toContain('Reactivate');

    fixture.componentRef.setInput('userId', '2');
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/users/2').flush({
      userId: '2',
      username: 'chopper',
      email: 'chopper@onepiece.local',
      status: 'DISABLED',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    root = fixture.nativeElement as HTMLElement;
    buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Reactivate');
    expect(buttons).not.toContain('Revoke Access');
  });

  it('revokes access after confirmation and reloads the crewmate', async () => {
    const fixture = createWithUserId('1');
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeAccessButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke Access',
    );
    revokeAccessButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirm',
    );
    expect(confirmButton).toBeTruthy();
    confirmButton!.click();
    fixture.detectChanges();

    const postRequest = httpTesting.expectOne('/api/admin/users/1/revoke-access');
    expect(postRequest.request.method).toBe('POST');
    postRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({ message: "nami's access has been revoked!", tone: 'success' }),
    );

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'DISABLED',
      roles: ['EDITOR'],
    });
  });

  it('cancelling the confirmation makes no request', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeAccessButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke Access',
    );
    revokeAccessButton!.click();
    fixture.detectChanges();

    const cancelButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    );
    cancelButton!.click();
    fixture.detectChanges();

    httpTesting.expectNone('/api/admin/users/1/revoke-access');
  });

  it('reactivates a disabled crewmate after confirmation', async () => {
    const fixture = createWithUserId('1');
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'chopper',
      email: 'chopper@onepiece.local',
      status: 'DISABLED',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const reactivateButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reactivate',
    );
    reactivateButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirm',
    );
    confirmButton!.click();
    fixture.detectChanges();

    const postRequest = httpTesting.expectOne('/api/admin/users/1/reactivate');
    expect(postRequest.request.method).toBe('POST');
    postRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'chopper may sail with the crew once more!',
        tone: 'success',
      }),
    );

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'chopper',
      email: 'chopper@onepiece.local',
      status: 'PENDING',
      roles: ['EDITOR'],
    });
  });

  it('shows a themed error toast when revoking access would leave zero administrators', async () => {
    const fixture = createWithUserId('1');
    const toastService = TestBed.inject(ToastService);

    httpTesting.expectOne('/api/admin/users/1').flush({
      userId: '1',
      username: 'luffy',
      email: 'luffy@onepiece.local',
      status: 'ACTIVE',
      roles: ['ADMIN'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeAccessButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke Access',
    );
    revokeAccessButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirm',
    );
    confirmButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/admin/users/1/revoke-access').flush(
      {
        detail: 'Cannot leave the realm with zero ADMIN users',
        errorCode: 'USER_LAST_ADMINISTRATOR',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        tone: 'error',
      }),
    );
  });
});
