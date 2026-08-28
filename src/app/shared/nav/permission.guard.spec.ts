import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  let httpTesting: HttpTestingController;
  let router: Router;
  let navigate: ReturnType<typeof spyOnNavigate>;

  function spyOnNavigate(target: Router) {
    return vi.spyOn(target, 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigate = spyOnNavigate(router);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function routeRequiring(permission: string | undefined): ActivatedRouteSnapshot {
    return {
      data: permission ? { permission } : {},
      pathFromRoot: [],
    } as unknown as ActivatedRouteSnapshot;
  }

  it('allows navigation immediately when the route requires no permission', () => {
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(routeRequiring(undefined), {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('allows navigation once the caller is confirmed to have the required permission', async () => {
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(routeRequiring('users:read'), {} as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    TestBed.inject(ApplicationRef).tick();

    httpTesting.expectOne('/api/me').flush({
      username: 'luffy',
      email: 'luffy@onepiece.local',
      roles: ['ADMIN'],
      permissions: ['users:read'],
    });

    expect(await firstValueFrom(result)).toBe(true);
  });

  it('blocks navigation and redirects to /forbidden when the caller lacks the permission', async () => {
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(routeRequiring('audit:read'), {} as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    TestBed.inject(ApplicationRef).tick();

    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: ['EDITOR'],
      permissions: ['docs:read', 'docs:write'],
    });

    expect(await firstValueFrom(result)).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/forbidden'], {
      state: { route: '/', permission: 'audit:read', roles: ['EDITOR'] },
    });
  });
});
