import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../toast/toast';
import { apiErrorInterceptor } from './error-interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let toastService: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    toastService = TestBed.inject(ToastService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it.each([
    [401, "session's sunk"],
    [403, "don't have clearance"],
    [500, 'broke on our end'],
    [0, 'broke on our end'],
  ])('shows a themed toast for a %d response', async (status, expectedSnippet) => {
    const request = firstValueFrom(http.get('/api/whatever')).catch(() => undefined);

    httpTesting.expectOne('/api/whatever').flush('', { status, statusText: 'Error' });
    await request;

    expect(toastService.toasts()).toHaveLength(1);
    expect(toastService.toasts()[0].message).toContain(expectedSnippet);
    expect(toastService.toasts()[0].tone).toBe('error');
  });

  it.each([400, 404, 409])(
    'does not show a toast for a %d response, leaving it to the caller',
    async (status) => {
      const request = firstValueFrom(http.get('/api/whatever')).catch(() => undefined);

      httpTesting.expectOne('/api/whatever').flush('', { status, statusText: 'Error' });
      await request;

      expect(toastService.toasts()).toHaveLength(0);
    },
  );

  it('still rethrows the error so the caller can handle it too', async () => {
    const request = firstValueFrom(http.get('/api/whatever'));
    const expectation = expect(request).rejects.toMatchObject({ status: 401 });

    httpTesting.expectOne('/api/whatever').flush('', { status: 401, statusText: 'Unauthorized' });

    await expectation;
  });
});
