import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '../shared/toast/toast';
import { ResendInvitationService } from './resend-invitation.service';

describe('ResendInvitationService', () => {
  let service: ResendInvitationService;
  let httpTesting: HttpTestingController;
  let toastService: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ResendInvitationService);
    httpTesting = TestBed.inject(HttpTestingController);
    toastService = TestBed.inject(ToastService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('resolves true and shows a success toast when the resend succeeds', async () => {
    const promise = service.resend({ userId: '1', email: 'usopp@onepiece.local' });

    httpTesting.expectOne('/api/admin/users/1/resend-invitation').flush(null);

    expect(await promise).toBe(true);
    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'Resent the invitation to usopp@onepiece.local!',
        tone: 'success',
      }),
    );
  });

  it('resolves true and shows an error toast when the invitation is no longer resendable', async () => {
    const promise = service.resend({ userId: '1', email: 'usopp@onepiece.local' });

    httpTesting
      .expectOne('/api/admin/users/1/resend-invitation')
      .flush(
        { detail: 'Not resendable', errorCode: 'USER_INVITATION_NOT_RESENDABLE' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(await promise).toBe(true);
    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message:
          "Arrr! usopp@onepiece.local's invitation isn't resendable anymore — refresh to see the latest status.",
        tone: 'error',
      }),
    );
  });

  it('resolves true and shows an error toast when the user no longer exists', async () => {
    const promise = service.resend({ userId: '1', email: 'usopp@onepiece.local' });

    httpTesting.expectOne('/api/admin/users/1/resend-invitation').flush('nope', {
      status: 404,
      statusText: 'Not Found',
    });

    expect(await promise).toBe(true);
    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'Arrr! usopp@onepiece.local be gone from the crew.',
        tone: 'error',
      }),
    );
  });

  it('resolves false and shows an error toast when the email fails to deliver', async () => {
    const promise = service.resend({ userId: '1', email: 'usopp@onepiece.local' });

    httpTesting
      .expectOne('/api/admin/users/1/resend-invitation')
      .flush(
        { detail: 'Could not send the invitation email', errorCode: 'USER_EMAIL_DELIVERY_FAILED' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(await promise).toBe(false);
    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message:
          'Arrr! Could not resend the invitation to usopp@onepiece.local - the message bird got lost.',
        tone: 'error',
      }),
    );
  });

  it('resolves false without an inline toast for an unrelated server failure', async () => {
    const promise = service.resend({ userId: '1', email: 'usopp@onepiece.local' });

    httpTesting.expectOne('/api/admin/users/1/resend-invitation').flush('nope', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    expect(await promise).toBe(false);
  });
});
