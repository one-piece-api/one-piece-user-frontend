import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { logoutUrl } from './auth-urls';

const ME_ENDPOINT = '/api/me';

interface Me {
  email: string;
  roles: string[];
}

/**
 * A `/api/me` failure is realistically always 401 (expired/invalid token) - already
 * surfaced by apiErrorInterceptor's themed toast, plus the "Lost at sea" state below, so
 * this component doesn't also raise its own toast for the same failure.
 */
@Component({
  selector: 'app-who-am-i',
  templateUrl: './who-am-i.html',
  imports: [Card, Badge, RouterLink],
})
export class WhoAmI {
  protected readonly me = httpResource<Me>(() => ME_ENDPOINT);
  protected readonly logoutUrl = logoutUrl();
  protected readonly logoutClasses = buttonClasses('danger');
  protected readonly adminLinkClasses = buttonClasses('secondary');
}
