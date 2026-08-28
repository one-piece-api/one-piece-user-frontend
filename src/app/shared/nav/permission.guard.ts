import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { CurrentUserService } from '../../identity/current-user';

/** Route `data.permission`, checked against the caller's effective permissions (see `Me`). */
export interface ForbiddenState {
  readonly route: string;
  readonly permission: string;
  readonly roles: string[];
}

/**
 * Waits for the in-flight `/api/me` fetch to settle (loading or reloading) before deciding,
 * rather than judging on whatever `CurrentUserService` happens to hold at the instant the
 * guard runs - on a fresh navigation that's almost always "nothing yet".
 */
export const permissionGuard: CanActivateFn = (route) => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);
  const permission = route.data['permission'] as string | undefined;

  if (!permission) {
    return true;
  }

  return toObservable(currentUser.me.isLoading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => {
      if (currentUser.hasPermission(permission)) {
        return true;
      }
      const attemptedRoute =
        '/' +
        route.pathFromRoot
          .map((segment) => segment.url.join('/'))
          .filter(Boolean)
          .join('/');
      const state: ForbiddenState = {
        route: attemptedRoute,
        permission,
        roles: currentUser.me.value()?.roles ?? [],
      };
      // createUrlTree has no `state` option (that's navigate/navigateByUrl only), so the
      // redirect is issued imperatively here rather than returned as a UrlTree.
      void router.navigate(['/forbidden'], { state });
      return false;
    }),
  );
};
