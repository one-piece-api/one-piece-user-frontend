import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { PageHeader } from '../shared/ui/page-header';
import { deleteAccountUrl } from './auth-urls';
import { CurrentUserService } from './current-user';

/**
 * No confirmation modal here by design: the link goes straight to Keycloak's own
 * "account" client (see auth-urls.ts), which performs the deletion on its hosted,
 * already-authenticated page and requires a fresh re-authentication before honoring
 * it (its own step-up behavior for this action, verified live) plus its own explicit
 * Confirm/Cancel step - that's the real confirmation safeguard, not a second one
 * duplicated here. There is no backend call either: user-service is never involved
 * in this action (see the ADR).
 */
@Component({
  selector: 'app-who-am-i',
  templateUrl: './who-am-i.html',
  imports: [Card, Badge, PageHeader, TranslocoPipe],
})
export class WhoAmI {
  protected readonly currentUser = inject(CurrentUserService);

  protected readonly dangerClasses = buttonClasses('danger');
  protected readonly deleteAccountUrl = deleteAccountUrl();
}
