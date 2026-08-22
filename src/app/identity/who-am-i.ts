import { httpResource } from '@angular/common/http';
import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../shared/toast/toast';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { logoutUrl } from './auth-urls';

const ME_ENDPOINT = '/api/me';

interface Me {
  email: string;
  roles: string[];
}

@Component({
  selector: 'app-who-am-i',
  templateUrl: './who-am-i.html',
  imports: [Card, Badge, RouterLink],
})
export class WhoAmI {
  private readonly toastService = inject(ToastService);

  protected readonly me = httpResource<Me>(() => ME_ENDPOINT);
  protected readonly logoutUrl = logoutUrl();
  protected readonly logoutClasses = buttonClasses('danger');
  protected readonly adminLinkClasses = buttonClasses('secondary');

  constructor() {
    effect(() => {
      if (this.me.error()) {
        this.toastService.show(
          'Arrr! Could not fetch your identity — try again in a moment.',
          'error',
        );
      }
    });
  }
}
