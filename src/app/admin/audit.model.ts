import type { BadgeTone } from '../shared/ui/badge';

/**
 * One audit record (§13, Step 17) - never carries credential material.
 * `targetUserId`/`targetEmail` are set when the event targets a user account;
 * `targetLabel` carries whatever extra context a plain actor/target pair can't say by
 * itself - which role was granted/revoked, a role/permission catalog entity's name, or
 * (for a permission assigned to/revoked from a role) both, encoded as `"role <- permission"`
 * (see ADR-0012 in one-piece-user-service). Never set for actions that need neither.
 */
export interface AuditEvent {
  action: string;
  actorUserId: string;
  actorEmail: string;
  targetUserId?: string;
  targetEmail?: string;
  targetLabel?: string;
  occurredAt: string;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  USER_INVITED: 'Invited User',
  INVITATION_RESENT: 'Resent Invitation',
  ROLE_ASSIGNED: 'Granted Role',
  ROLE_REVOKED: 'Revoked Role',
  ACCESS_REVOKED: 'Revoked Access',
  ACCESS_REACTIVATED: 'Reactivated Account',
  ROLE_CREATED: 'Created Role',
  ROLE_DELETED: 'Deleted Role',
  PERMISSION_CREATED: 'Created Permission',
  PERMISSION_DELETED: 'Deleted Permission',
  PERMISSION_ASSIGNED_TO_ROLE: 'Granted Permission',
  PERMISSION_REVOKED_FROM_ROLE: 'Revoked Permission',
};

export const AUDIT_ACTION_TONE: Record<string, BadgeTone> = {
  USER_INVITED: 'gold',
  INVITATION_RESENT: 'gold',
  ROLE_ASSIGNED: 'success',
  ROLE_REVOKED: 'danger',
  ACCESS_REVOKED: 'danger',
  ACCESS_REACTIVATED: 'success',
  ROLE_CREATED: 'success',
  ROLE_DELETED: 'danger',
  PERMISSION_CREATED: 'success',
  PERMISSION_DELETED: 'danger',
  PERMISSION_ASSIGNED_TO_ROLE: 'success',
  PERMISSION_REVOKED_FROM_ROLE: 'danger',
};

const OCCURRED_AT_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Renders an ISO instant in the viewer's own locale/timezone. */
export function formatOccurredAt(occurredAt: string): string {
  return OCCURRED_AT_FORMAT.format(new Date(occurredAt));
}

/** `targetLabel`'s encoding for a permission-on-role action - see `AuditEvent` above. */
function splitRolePermissionLabel(label: string): { role: string; permission: string } | null {
  const [role, permission] = label.split(' <- ');
  return role && permission ? { role, permission } : null;
}

/**
 * Turns one audit record into the specific sentence its action type calls for, instead of
 * a generic "actor → target" that goes blank for anything that isn't a plain user-to-user
 * action (a role/permission catalog change has no target user at all). Each branch reads
 * exactly the fields its action populates - see `AuditEvent`'s field-by-field contract
 * above and `AuditEventMapper` (one-piece-user-service) for what each action sends.
 */
export function formatAuditMessage(event: AuditEvent): string {
  const target = event.targetEmail ?? '';
  const label = event.targetLabel ?? '';
  switch (event.action) {
    case 'USER_INVITED':
      return `Invitation sent to ${target} as ${label}`;
    case 'INVITATION_RESENT':
      return `Invitation resent to ${target}`;
    case 'ROLE_ASSIGNED':
      return `Role ${label} assigned to ${target}`;
    case 'ROLE_REVOKED':
      return `Role ${label} revoked from ${target}`;
    case 'ACCESS_REVOKED':
      return `Access revoked for ${target}`;
    case 'ACCESS_REACTIVATED':
      return `Access reactivated for ${target}`;
    case 'ROLE_CREATED':
      return `Role ${label} created`;
    case 'ROLE_DELETED':
      return `Role ${label} deleted`;
    case 'PERMISSION_CREATED':
      return `Permission ${label} created`;
    case 'PERMISSION_DELETED':
      return `Permission ${label} deleted`;
    case 'PERMISSION_ASSIGNED_TO_ROLE': {
      const parsed = splitRolePermissionLabel(label);
      return parsed
        ? `Permission ${parsed.permission} granted to ${parsed.role}`
        : `Permission granted (${label})`;
    }
    case 'PERMISSION_REVOKED_FROM_ROLE': {
      const parsed = splitRolePermissionLabel(label);
      return parsed
        ? `Permission ${parsed.permission} revoked from ${parsed.role}`
        : `Permission revoked (${label})`;
    }
    default:
      return AUDIT_ACTION_LABEL[event.action] ?? event.action;
  }
}
