import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { SessionExpired } from './session-expired';

describe('SessionExpired', () => {
  const originalLocation = window.location;
  let locationAssign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    locationAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: locationAssign },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  function createWithReturnTo(returnTo: string | null) {
    TestBed.configureTestingModule({
      imports: [SessionExpired],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnTo ? { returnTo } : {}) },
          },
        },
      ],
    });
    return TestBed.createComponent(SessionExpired);
  }

  it('redirects to login with the given returnTo after a short delay', () => {
    createWithReturnTo('/users?tab=roles');
    expect(locationAssign).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(locationAssign).toHaveBeenCalledWith(
      '/oauth2/start?rd=' + encodeURIComponent('/users?tab=roles'),
    );
  });

  it('falls back to the app root when no returnTo is present', () => {
    createWithReturnTo(null);

    vi.runAllTimers();

    expect(locationAssign).toHaveBeenCalledWith('/oauth2/start?rd=' + encodeURIComponent('/'));
  });
});
