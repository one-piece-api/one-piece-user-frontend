import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { logoutUrl } from '../../identity/auth-urls';
import { CurrentUserService } from '../../identity/current-user';
import { NAV_GROUPS, type NavGroup } from '../nav/nav-items';

/**
 * The application's page shell: a persistent sidebar (desktop) / off-canvas drawer
 * (mobile) wrapping every route's content, replacing the previous top navbar. Sections
 * are read from the nav registry (`shared/nav/nav-items.ts`), not hardcoded per role.
 */
@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.html',
  imports: [RouterLink, RouterLinkActive],
})
export class AppShell {
  protected readonly currentUser = inject(CurrentUserService);
  protected readonly logoutUrl = logoutUrl();
  protected readonly navGroups = NAV_GROUPS;
  protected readonly drawerOpen = signal(false);

  /** One computed string so the open/closed translate utilities are never both present at once. */
  protected readonly asideClasses = computed(
    () =>
      `fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-6 overflow-y-auto bg-ocean-900 p-5 shadow-2xl transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${
        this.drawerOpen() ? 'translate-x-0' : '-translate-x-full'
      }`,
  );

  protected visibleItems(group: NavGroup) {
    const roles = this.currentUser.me.value()?.roles ?? [];
    return group.items.filter((item) => !item.requiredRole || roles.includes(item.requiredRole));
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected initials(username: string): string {
    return username.slice(0, 2).toUpperCase();
  }
}
