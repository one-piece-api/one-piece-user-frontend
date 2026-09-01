import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { loginUrl } from './auth-urls';

/** How long the interstitial stays up before the actual redirect fires. */
const REDIRECT_DELAY_MS = 1800;

/**
 * Shown instead of an instant `window.location.assign` on a 401 (see
 * `shared/http/error-interceptor.ts`), so a session drop reads as a themed moment rather
 * than an unexplained flash to Keycloak's login page.
 */
@Component({
  selector: 'app-session-expired',
  templateUrl: './session-expired.html',
  imports: [TranslocoPipe],
})
export class SessionExpired {
  private readonly route = inject(ActivatedRoute);

  constructor() {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') || '/';
    setTimeout(() => window.location.assign(loginUrl(returnTo)), REDIRECT_DELAY_MS);
  }
}
