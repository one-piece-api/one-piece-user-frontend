export interface NavItem {
  readonly id: string;
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly label: string;
  readonly icon: string;
  /** Where the item leads. Absent on an item that is only announced (`soon`). */
  readonly route?: string;
  /** No permission required (undefined) means every signed-in user sees the item. */
  readonly permission?: string;
  /** Announced but not built yet: shown with a "coming soon" tag, and not a link. */
  readonly soon?: boolean;
}

export interface NavGroup {
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly labelKey: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    // The overview across entity types (docs/user-flows/content-editorial-workflow.md 6);
    // one entry per status joins it with the status pages.
    labelKey: 'shell.nav.dashboard',
    items: [
      {
        id: 'dashboard',
        label: 'shell.nav.overview',
        icon: '◎',
        route: '/dashboard',
        permission: 'content:read',
      },
    ],
  },
  {
    // One entry per content entity (docs/user-flows/content-editorial-workflow.md 6): the
    // ones not built yet are announced, so the section shows where the encyclopedia is going.
    labelKey: 'shell.nav.contents',
    items: [
      {
        id: 'characters',
        label: 'shell.nav.characters',
        icon: '☺',
        permission: 'content:read',
        soon: true,
      },
      {
        id: 'devil-fruits',
        label: 'shell.nav.devilFruits',
        icon: '◆',
        permission: 'content:read',
        soon: true,
      },
      {
        id: 'devil-fruit-types',
        label: 'shell.nav.devilFruitTypes',
        icon: '◈',
        route: '/content/devil-fruit-types',
        permission: 'content:read',
      },
      { id: 'crews', label: 'shell.nav.crews', icon: '⚑', permission: 'content:read', soon: true },
      { id: 'arcs', label: 'shell.nav.arcs', icon: '≡', permission: 'content:read', soon: true },
    ],
  },
  {
    labelKey: 'shell.nav.account',
    items: [{ id: 'profile', label: 'shell.nav.profile', icon: '◆', route: '/profile' }],
  },
  {
    labelKey: 'shell.nav.admin',
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
