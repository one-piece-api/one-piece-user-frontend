import { TONE_BORDER_CLASS, type BadgeTone } from '../shared/ui/badge';

export type AccountStatus = 'PENDING' | 'INVITATION_EXPIRED' | 'ACTIVE' | 'DISABLED';

export interface AdminUserSummary {
  userId: string;
  username: string;
  email: string;
  status: AccountStatus;
  roles: string[];
}

/** The realm roles an ADMIN can grant/revoke (Step 6) or select at invite time (Step 4). */
export const ASSIGNABLE_ROLES = ['ADMIN', 'REVIEWER', 'EDITOR'] as const;

export const STATUS_TONE: Record<AccountStatus, BadgeTone> = {
  ACTIVE: 'success',
  PENDING: 'gold',
  INVITATION_EXPIRED: 'danger',
  DISABLED: 'neutral',
};

export const STATUS_LABEL: Record<AccountStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  INVITATION_EXPIRED: 'Invite Expired',
  DISABLED: 'Disabled',
};

/** A status's accent as a left-border color - the Crew Manifest rows and the User Detail card stripe. */
export function statusBorderClass(status: AccountStatus): string {
  return TONE_BORDER_CLASS[STATUS_TONE[status]];
}

/** One realm role and the permissions it currently bundles - see `GET /roles` (ADR-0007). */
export interface RolePermissions {
  role: string;
  permissions: string[];
}
