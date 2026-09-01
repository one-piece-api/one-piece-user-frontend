import { TONE_BORDER_CLASS, type BadgeTone } from '../shared/ui/badge';

export type AccountStatus = 'PENDING' | 'INVITATION_EXPIRED' | 'ACTIVE' | 'DISABLED';

export interface AdminUserSummary {
  userId: string;
  username: string;
  email: string;
  status: AccountStatus;
  roles: string[];
}

export const STATUS_TONE: Record<AccountStatus, BadgeTone> = {
  ACTIVE: 'success',
  PENDING: 'gold',
  INVITATION_EXPIRED: 'danger',
  DISABLED: 'neutral',
};

/** Translation keys, not display text - templates resolve them with `| transloco`. */
export const STATUS_LABEL_KEY: Record<AccountStatus, string> = {
  ACTIVE: 'users.status.active',
  PENDING: 'users.status.pending',
  INVITATION_EXPIRED: 'users.status.invitationExpired',
  DISABLED: 'users.status.disabled',
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
