import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
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
 */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toastService = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const message = genericMessageFor(error.status);
        if (message) {
          toastService.show(message, 'error');
        }
      }
      return throwError(() => error);
    }),
  );
};

function genericMessageFor(status: number): string | null {
  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }
  if (status === 403) {
    return "You don't have permission to perform this action.";
  }
  if (status === 0 || status >= 500) {
    return 'Something went wrong. Please try again.';
  }
  return null;
}
