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
import { homeGuard } from './home.guard';

describe('homeGuard', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Runs the guard for a caller holding `permissions`, and returns where it sends them. */
  async function destinationFor(permissions: string[]): Promise<string> {
    const result = TestBed.runInInjectionContext(() =>
      homeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    TestBed.inject(ApplicationRef).tick();
    httpTesting
      .expectOne('/api/me')
      .flush({ username: 'nami', email: 'nami@onepiece.local', roles: [], permissions });
    const tree = (await firstValueFrom(result)) as UrlTree;
    return TestBed.inject(Router).serializeUrl(tree);
  }

  it('opens the dashboard for whoever reads content', async () => {
    expect(await destinationFor(['content:read', 'content:write'])).toBe('/dashboard');
  });

  it('opens the profile for whoever reads no content', async () => {
    expect(await destinationFor(['users:read'])).toBe('/profile');
  });
});
