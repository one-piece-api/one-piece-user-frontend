import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { logoutUrl } from './auth-urls';

const ME_ENDPOINT = '/api/me';

interface Me {
  email: string;
  roles: string[];
}

@Component({
  selector: 'app-who-am-i',
  templateUrl: './who-am-i.html',
})
export class WhoAmI {
  protected readonly me = httpResource<Me>(() => ME_ENDPOINT);
  protected readonly logoutUrl = logoutUrl();
}
