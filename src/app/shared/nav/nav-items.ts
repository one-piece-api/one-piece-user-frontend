import { DEVIL_FRUIT_TYPE_ICON } from '../../content/devil-fruit-types/devil-fruit-type.model';
import { STATUS_LABEL_KEY } from '../../content/content.model';
import {
  DASHBOARD_ICON,
  DASHBOARD_ROUTE,
  OVERVIEW_ICON,
  STATUS_PAGES,
  statusPageRoute,
} from '../../content/dashboard/dashboard.model';
import { STATUS_GLYPH } from '../../content/status-badge';

export interface NavItem {
  readonly id: string;
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly label: string;
  readonly icon: string;
  /** Where the item leads. Absent on an item that is only announced (`soon`). */
  readonly route?: string;
  /** No permission required (undefined) means every signed-in user sees the item. */
  readonly permission?: string;
  /** Seen by whoever holds any of these - when one permission alone does not say it. */
  readonly anyPermission?: readonly string[];
  /** Highlighted only on its own route, not on the ones nested under it. */
  readonly exact?: boolean;
  /** Announced but not built yet: shown with a "coming soon" tag, and not a link. */
  readonly soon?: boolean;
}

export interface NavGroup {
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly labelKey: string;
  readonly icon: string;
  /** Its flyout tells how many of its sections are already open (not `soon`). */
  readonly countsLiveItems?: boolean;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    // The overview across entity types (docs/user-flows/content-editorial-workflow.md 6);
    // then one entry per status page, for whoever sees that status.
    labelKey: 'shell.nav.dashboard',
    icon: DASHBOARD_ICON,
    items: [
      {
        id: 'dashboard',
        label: 'shell.nav.overview',
        icon: OVERVIEW_ICON,
        route: DASHBOARD_ROUTE,
        permission: 'content:read',
        exact: true,
      },
      ...STATUS_PAGES.map((page) => ({
        id: `dashboard:${page.slug}`,
        label: STATUS_LABEL_KEY[page.status],
        icon: STATUS_GLYPH[page.status],
        route: statusPageRoute(page.status),
        anyPermission: page.anyPermission,
      })),
    ],
  },
  {
    // One entry per content entity (docs/user-flows/content-editorial-workflow.md 6): the
    // ones not built yet are announced, so the section shows where the encyclopedia is going.
    labelKey: 'shell.nav.contents',
    icon: 'assets/contents.webp',
    countsLiveItems: true,
    items: [
      {
        id: 'characters',
        label: 'shell.nav.characters',
        icon: 'assets/characters.webp',
        permission: 'content:read',
        soon: true,
      },
      {
        id: 'devil-fruits',
        label: 'shell.nav.devilFruits',
        icon: 'assets/devil-fruit.webp',
        permission: 'content:read',
        soon: true,
      },
      {
        id: 'devil-fruit-types',
        label: 'shell.nav.devilFruitTypes',
        icon: DEVIL_FRUIT_TYPE_ICON,
        route: '/content/devil-fruit-types',
        permission: 'content:read',
      },
      {
        id: 'crews',
        label: 'shell.nav.crews',
        icon: 'assets/crews.webp',
        permission: 'content:read',
        soon: true,
      },
    ],
  },
  {
    labelKey: 'shell.nav.account',
    icon: 'assets/profile.webp',
    items: [
      { id: 'profile', label: 'shell.nav.profile', icon: 'assets/profile.webp', route: '/profile' },
    ],
  },
  {
    labelKey: 'shell.nav.admin',
    icon: '⚑',
    items: [
      {
        id: 'users',
        label: 'shell.nav.crewManifest',
        icon: '⚑',
        route: '/users',
        permission: 'users:read',
      },
      {
        id: 'roles',
        label: 'shell.nav.rolesPermissions',
        icon: '⚙',
        route: '/roles',
        permission: 'roles:manage',
      },
      {
        id: 'audit',
        label: 'shell.nav.shipsLog',
        icon: '▤',
        route: '/audit',
        permission: 'audit:read',
      },
      {
        id: 'languages',
        label: 'shell.nav.languages',
        icon: '⚐',
        route: '/languages',
        permission: 'languages:manage',
      },
    ],
  },
];
