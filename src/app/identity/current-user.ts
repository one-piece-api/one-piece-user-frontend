import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';

const ME_ENDPOINT = '/api/me';

export interface Me {
  username: string;
  email: string;
  roles: string[];
}

/** Single source of truth for "who am I" - shared by the navbar and the profile page, one request. */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  readonly me = httpResource<Me>(() => ME_ENDPOINT);
}
