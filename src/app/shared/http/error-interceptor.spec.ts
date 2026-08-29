import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MascotService } from '../mascot/mascot';
import { apiErrorInterceptor } from './error-interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let mascotService: MascotService;
  let router: Router;
  let navigateByUrl: ReturnType<typeof spyOnNavigateByUrl>;
  const originalLocation = window.location;

  function spyOnNavigateByUrl(target: Router) {
    return vi.spyOn(target, 'navigateByUrl').mockResolvedValue(true);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    mascotService = TestBed.inject(MascotService);
    router = TestBed.inject(Router);
    navigateByUrl = spyOnNavigateByUrl(router);

    // jsdom's `location` is non-configurable, so it can't be spied on directly - the
    // whole `window.location` is replaced with a stub instead.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/admin/users', search: '?tab=roles' },
    });
  });

  afterEach(() => {
    httpTesting.verify();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it.each([
    [403, "don't have clearance"],
    [500, 'broke on our end'],
    [0, 'broke on our end'],
  ])('shows a themed message for a %d response', async (status, expectedSnippet) => {
    const request = firstValueFrom(http.get('/api/whatever')).catch(() => undefined);

    httpTesting.expectOne('/api/whatever').flush('', { status, statusText: 'Error' });
    await request;

    expect(mascotService.open()).toBe(true);
    expect(mascotService.message().text).toContain(expectedSnippet);
    expect(mascotService.message().tone).toBe('error');
  });

  it('shows no message for a 401, sending the browser through the Session Expired page instead', async () => {
    const request = firstValueFrom(http.get('/api/whatever')).catch(() => undefined);

    httpTesting.expectOne('/api/whatever').flush('', { status: 401, statusText: 'Unauthorized' });
    await request;

    expect(mascotService.open()).toBe(false);
  });

  it('navigates to Session Expired on a 401, carrying the current page as returnTo', async () => {
    const request = firstValueFrom(http.get('/api/whatever')).catch(() => undefined);

    httpTesting.expectOne('/api/whatever').flush('', { status: 401, statusText: 'Unauthorized' });
    await request;

    expect(navigateByUrl).toHaveBeenCalledWith(
      '/session-expired?returnTo=' + encodeURIComponent('/admin/users?tab=roles'),
    );
  });

  it.each([403, 500, 0])(
    'does not navigate to Session Expired for a %d response',
    async (status) => {
      const request = firstValueFrom(http.get('/api/whatever')).catch(() => undefined);

      httpTesting.expectOne('/api/whatever').flush('', { status, statusText: 'Error' });
      await request;

      expect(navigateByUrl).not.toHaveBeenCalled();
    },
  );

  it.each([400, 404, 409])(
    'does not show a message for a %d response, leaving it to the caller',
    async (status) => {
      const request = firstValueFrom(http.get('/api/whatever')).catch(() => undefined);

      httpTesting.expectOne('/api/whatever').flush('', { status, statusText: 'Error' });
      await request;

      expect(mascotService.open()).toBe(false);
    },
  );

  it('still rethrows the error so the caller can handle it too', async () => {
    const request = firstValueFrom(http.get('/api/whatever'));
    const expectation = expect(request).rejects.toMatchObject({ status: 401 });

    httpTesting.expectOne('/api/whatever').flush('', { status: 401, statusText: 'Unauthorized' });

    await expectation;
  });
});
