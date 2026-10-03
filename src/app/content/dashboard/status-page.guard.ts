import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { CurrentUserService } from '../../identity/current-user';
import type { ForbiddenState } from '../../shared/nav/permission.guard';
import { DASHBOARD_ROUTE, statusPageOf } from './dashboard.model';

/**
 * A status page opens for whoever sees its status - any of its permissions - like its
 * sidebar entry; anyone else lands on "forbidden", as with `permissionGuard`. A slug that
 * names no status page leads back to the overview.
 */
export const statusPageGuard: CanActivateFn = (route) => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);
  const page = statusPageOf(route.paramMap.get('status'));
  if (!page) {
    return router.parseUrl(DASHBOARD_ROUTE);
  }
  return toObservable(currentUser.me.isLoading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => {
      if (currentUser.hasAnyPermission(page.anyPermission)) {
        return true;
      }
      const state: ForbiddenState = {
        route: `${DASHBOARD_ROUTE}/${page.slug}`,
        permission: page.anyPermission.join(' / '),
        roles: currentUser.me.value()?.roles ?? [],
      };
      void router.navigate(['/forbidden'], { state });
      return false;
    }),
  );
};
