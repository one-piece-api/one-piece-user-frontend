import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { CurrentUserService } from '../../identity/current-user';

/** Where the app opens: the dashboard for whoever reads content, the profile for anyone else. */
export const DASHBOARD_ROUTE = '/dashboard';
export const PROFILE_ROUTE = '/profile';
const DASHBOARD_PERMISSION = 'content:read';

/**
 * The root has no page of its own: once `/api/me` has answered, it sends the caller to the
 * dashboard when they may read content, to their profile otherwise - every signed-in user
 * has one. Like `permissionGuard`, it waits for the in-flight fetch rather than judging on
 * "nothing loaded yet".
 */
export const homeGuard: CanActivateFn = () => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);
  return toObservable(currentUser.me.isLoading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() =>
      router.parseUrl(
        currentUser.hasPermission(DASHBOARD_PERMISSION) ? DASHBOARD_ROUTE : PROFILE_ROUTE,
      ),
    ),
  );
};
