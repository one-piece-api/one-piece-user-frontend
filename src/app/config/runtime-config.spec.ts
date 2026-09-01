import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { getRuntimeConfig, loadRuntimeConfig } from './runtime-config';

describe('runtime-config', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('adopts the fetched config.json', async () => {
    const promise = loadRuntimeConfig(http);
    httpTesting.expectOne('/config.json').flush({ keycloakOrigin: 'http://84.8.249.65' });
    await promise;

    expect(getRuntimeConfig().keycloakOrigin).toBe('http://84.8.249.65');
  });

  it('keeps the previous value if config.json cannot be fetched', async () => {
    const primed = loadRuntimeConfig(http);
    httpTesting.expectOne('/config.json').flush({ keycloakOrigin: 'http://example.test' });
    await primed;

    const promise = loadRuntimeConfig(http);
    httpTesting.expectOne('/config.json').error(new ProgressEvent('error'));

    await expect(promise).resolves.toBeUndefined();
    expect(getRuntimeConfig().keycloakOrigin).toBe('http://example.test');
  });
});
