import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { contentLanguageInterceptor } from './content-language-interceptor';

describe('contentLanguageInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(withInterceptors([contentLanguageInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    transloco = TestBed.inject(TranslocoService);
  });

  afterEach(() => httpTesting.verify());

  it("sends the UI's current language as Accept-Language", async () => {
    transloco.setActiveLang('it');

    const request = firstValueFrom(http.get('/api/whatever'));
    const req = httpTesting.expectOne('/api/whatever');
    req.flush({});
    await request;

    expect(req.request.headers.get('Accept-Language')).toBe('it');
  });

  it('updates the header again after the UI language changes', async () => {
    transloco.setActiveLang('en');
    const firstRequest = firstValueFrom(http.get('/api/whatever'));
    httpTesting.expectOne('/api/whatever').flush({});
    await firstRequest;

    transloco.setActiveLang('it');
    const secondRequest = firstValueFrom(http.get('/api/whatever'));
    const req = httpTesting.expectOne('/api/whatever');
    req.flush({});
    await secondRequest;

    expect(req.request.headers.get('Accept-Language')).toBe('it');
  });
});
