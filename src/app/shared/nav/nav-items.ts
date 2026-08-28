export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  /**
   * Gates visibility on a role name for now. Superseded by a `permission` field once the
   * real permission model lands (see docs/implementation-plan.md Step 14) - this registry's
   * shape is meant to survive that swap, only the gating check changes.
   */
  readonly requiredRole?: string;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Account',
    items: [{ id: 'profile', label: 'My Profile', icon: '◆', route: '/' }],
  },
  {
    label: 'Admin',
    items: [
      {
        id: 'users',
        label: 'Crew Manifest',
        icon: '⚑',
        route: '/admin/users',
        requiredRole: 'ADMIN',
      },
    ],
  },
];
