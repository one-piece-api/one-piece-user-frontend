import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { statusPageGuard } from './status-page.guard';

describe('statusPageGuard', () => {
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function run(slug: string): ReturnType<typeof statusPageGuard> {
    const route = { paramMap: convertToParamMap({ status: slug }) } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => statusPageGuard(route, {} as RouterStateSnapshot));
  }

  async function decide(slug: string, permissions: string[]): Promise<boolean | UrlTree> {
    const result = run(slug) as Observable<boolean | UrlTree>;
    TestBed.inject(ApplicationRef).tick();
    httpTesting
      .expectOne('/api/me')
      .flush({ username: 'zoro', email: 'zoro@onepiece.local', roles: ['REVIEWER'], permissions });
    return firstValueFrom(result);
  }

  it('sends a slug naming no status page back to the overview, without asking who calls', () => {
    const result = run('superseded');

    expect(isObservable(result)).toBe(false);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });

  it('opens Review to a reviewer, who does not write', async () => {
    expect(await decide('in-review', ['content:read', 'content:review'])).toBe(true);
  });

  it('turns a reviewer away from Draft, naming what it takes', async () => {
    expect(await decide('draft', ['content:read', 'content:review'])).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/forbidden'], {
      state: { route: '/dashboard/draft', permission: 'content:write', roles: ['REVIEWER'] },
    });
  });
});
