import type { BadgeTone } from '../shared/ui/badge';

/** One audit record (§13, Step 17) - never carries credential material. */
export interface AuditEvent {
  action: string;
  actorUserId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
  occurredAt: string;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  USER_INVITED: 'Invited User',
  INVITATION_RESENT: 'Resent Invitation',
  ROLE_ASSIGNED: 'Granted Role',
  ROLE_REVOKED: 'Revoked Role',
  ACCESS_REVOKED: 'Revoked Access',
  ACCESS_REACTIVATED: 'Reactivated Account',
};

export const AUDIT_ACTION_TONE: Record<string, BadgeTone> = {
  USER_INVITED: 'gold',
  INVITATION_RESENT: 'gold',
  ROLE_ASSIGNED: 'success',
  ROLE_REVOKED: 'danger',
  ACCESS_REVOKED: 'danger',
  ACCESS_REACTIVATED: 'success',
};

const OCCURRED_AT_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Renders an ISO instant in the viewer's own locale/timezone. */
export function formatOccurredAt(occurredAt: string): string {
  return OCCURRED_AT_FORMAT.format(new Date(occurredAt));
}
