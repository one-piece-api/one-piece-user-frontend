export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  /** No permission required (undefined) means every signed-in user sees the item. */
  readonly permission?: string;
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
        permission: 'users:read',
      },
      {
        id: 'audit',
        label: "Ship's Log",
        icon: '▤',
        route: '/admin/audit',
        permission: 'audit:read',
      },
    ],
  },
];
