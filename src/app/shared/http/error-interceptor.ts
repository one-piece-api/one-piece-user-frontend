import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../toast/toast';

/**
 * Centralizes the one part of HTTP error handling that is the same regardless of which
 * request failed: authentication/authorization problems and unexpected server failures
 * all get the same themed toast, wherever they happen. Validation, not-found and
 * conflict responses are deliberately left alone here - those need request-specific,
 * contextual handling (an inline field error, a "not found" message in place) that only
 * the calling code can provide, so they stay each component's job (see
 * `InviteUserForm.onSubmit`'s `USER_EMAIL_ALREADY_REGISTERED` check).
 *
 * A 401 sends the browser through the Session Expired interstitial (UF-IDU-09: no valid
 * refresh left, oauth2-proxy itself rejected the request) instead of a toast - a toast
 * alone would leave the user stuck on a page that can never succeed again without a full
 * reload, and an instant `window.location.assign` would flash straight to Keycloak with
 * no explanation.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toastService = inject(ToastService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          const returnTo = window.location.pathname + window.location.search;
          router.navigateByUrl(`/session-expired?returnTo=${encodeURIComponent(returnTo)}`);
        } else {
          const message = genericMessageFor(error.status);
          if (message) {
            toastService.show(message, 'error');
          }
        }
      }
      return throwError(() => error);
    }),
  );
};

function genericMessageFor(status: number): string | null {
  if (status === 403) {
    return "Arrr! Ye don't have clearance for that, matey.";
  }
  if (status === 0 || status >= 500) {
    return 'Arrr! Something broke on our end — try again in a moment.';
  }
  return null;
}
