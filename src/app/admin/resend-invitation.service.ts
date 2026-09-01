import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { apiErrorOf } from '../shared/http/api-error';
import { MascotService } from '../shared/mascot/mascot';

const USERS_ENDPOINT = '/api/users';
const INVITATION_NOT_RESENDABLE_ERROR_CODE = 'USER_INVITATION_NOT_RESENDABLE';
const EMAIL_DELIVERY_FAILED_ERROR_CODE = 'USER_EMAIL_DELIVERY_FAILED';

interface ResendableUser {
  userId: string;
  email: string;
}

/**
 * UF-IDU-03: re-triggers Keycloak's invitation email for an INVITATION_EXPIRED account - shared
 * by the Crew Manifest and the User Detail page (both only ever show the action for that status).
 */
@Injectable({ providedIn: 'root' })
export class ResendInvitationService {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

  /** Resolves true when the caller's user data is now stale and should be reloaded. */
  async resend(user: ResendableUser): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${USERS_ENDPOINT}/${user.userId}/resend-invitation`, {}),
      );
      this.mascotService.show(
        this.transloco.translate('users.resend.success', { email: user.email }),
        'success',
      );
      return true;
    } catch (err) {
      if (!(err instanceof HttpErrorResponse)) {
        return false;
      }
      if (apiErrorOf(err)?.errorCode === INVITATION_NOT_RESENDABLE_ERROR_CODE) {
        this.mascotService.show(
          this.transloco.translate('users.resend.notResendable', { email: user.email }),
          'error',
        );
        return true;
      }
      if (err.status === 404) {
        this.mascotService.show(
          this.transloco.translate('users.resend.userGone', { email: user.email }),
          'error',
        );
        return true;
      }
      if (apiErrorOf(err)?.errorCode === EMAIL_DELIVERY_FAILED_ERROR_CODE) {
        this.mascotService.show(
          this.transloco.translate('users.resend.deliveryFailed', { email: user.email }),
          'error',
        );
      }
      // 401/403/5xx already get a themed toast from apiErrorInterceptor.
      return false;
    }
  }
}
