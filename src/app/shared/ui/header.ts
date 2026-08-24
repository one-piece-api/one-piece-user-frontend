import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { logoutUrl } from '../../identity/auth-urls';
import { CurrentUserService } from '../../identity/current-user';

/** The application's own navbar - user management is one section behind it (ADMIN-only), not the whole app. */
@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  imports: [RouterLink, RouterLinkActive],
})
export class Header {
  protected readonly currentUser = inject(CurrentUserService);
  protected readonly logoutUrl = logoutUrl();
}
