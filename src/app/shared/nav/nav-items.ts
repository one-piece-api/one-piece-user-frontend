export interface NavItem {
  readonly id: string;
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  /** No permission required (undefined) means every signed-in user sees the item. */
  readonly permission?: string;
}

export interface NavGroup {
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly labelKey: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    labelKey: 'shell.nav.account',
    items: [{ id: 'profile', label: 'shell.nav.profile', icon: '◆', route: '/' }],
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
    ],
  },
];
