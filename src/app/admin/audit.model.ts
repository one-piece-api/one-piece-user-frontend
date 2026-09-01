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

/** Translation keys, not display text - templates resolve them with `| transloco`. */
export const AUDIT_ACTION_LABEL_KEY: Record<string, string> = {
  USER_INVITED: 'audit.action.userInvited',
  INVITATION_RESENT: 'audit.action.invitationResent',
  ROLE_ASSIGNED: 'audit.action.roleAssigned',
  ROLE_REVOKED: 'audit.action.roleRevoked',
  ACCESS_REVOKED: 'audit.action.accessRevoked',
  ACCESS_REACTIVATED: 'audit.action.accessReactivated',
  ROLE_CREATED: 'audit.action.roleCreated',
  ROLE_DELETED: 'audit.action.roleDeleted',
  PERMISSION_CREATED: 'audit.action.permissionCreated',
  PERMISSION_DELETED: 'audit.action.permissionDeleted',
  PERMISSION_ASSIGNED_TO_ROLE: 'audit.action.permissionAssignedToRole',
  PERMISSION_REVOKED_FROM_ROLE: 'audit.action.permissionRevokedFromRole',
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

/** Renders an ISO instant in the given (or the viewer's own) locale, in their own timezone. */
export function formatOccurredAt(occurredAt: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(occurredAt),
  );
}

/** `targetLabel`'s encoding for a permission-on-role action - see `AuditEvent` above. */
function splitRolePermissionLabel(label: string): { role: string; permission: string } | null {
  const [role, permission] = label.split(' <- ');
  return role && permission ? { role, permission } : null;
}

/** A translate function shaped like `TranslocoService#translate` - kept as a parameter
 * rather than injecting the service here, so this stays a plain, framework-agnostic
 * function the way the rest of this model file is. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Turns one audit record into the specific sentence its action type calls for, instead of
 * a generic "actor → target" that goes blank for anything that isn't a plain user-to-user
 * action (a role/permission catalog change has no target user at all). Each branch reads
 * exactly the fields its action populates - see `AuditEvent`'s field-by-field contract
 * above and `AuditEventMapper` (one-piece-user-service) for what each action sends.
 */
export function formatAuditMessage(event: AuditEvent, translate: Translate): string {
  const target = event.targetEmail ?? '';
  const label = event.targetLabel ?? '';
  switch (event.action) {
    case 'USER_INVITED':
      return translate('audit.message.userInvited', { target, label });
    case 'INVITATION_RESENT':
      return translate('audit.message.invitationResent', { target });
    case 'ROLE_ASSIGNED':
      return translate('audit.message.roleAssigned', { target, label });
    case 'ROLE_REVOKED':
      return translate('audit.message.roleRevoked', { target, label });
    case 'ACCESS_REVOKED':
      return translate('audit.message.accessRevoked', { target });
    case 'ACCESS_REACTIVATED':
      return translate('audit.message.accessReactivated', { target });
    case 'ROLE_CREATED':
      return translate('audit.message.roleCreated', { label });
    case 'ROLE_DELETED':
      return translate('audit.message.roleDeleted', { label });
    case 'PERMISSION_CREATED':
      return translate('audit.message.permissionCreated', { label });
    case 'PERMISSION_DELETED':
      return translate('audit.message.permissionDeleted', { label });
    case 'PERMISSION_ASSIGNED_TO_ROLE': {
      const parsed = splitRolePermissionLabel(label);
      return parsed
        ? translate('audit.message.permissionGrantedToRole', parsed)
        : translate('audit.message.permissionGrantedFallback', { label });
    }
    case 'PERMISSION_REVOKED_FROM_ROLE': {
      const parsed = splitRolePermissionLabel(label);
      return parsed
        ? translate('audit.message.permissionRevokedFromRole', parsed)
        : translate('audit.message.permissionRevokedFallback', { label });
    }
    default:
      return AUDIT_ACTION_LABEL_KEY[event.action]
        ? translate(AUDIT_ACTION_LABEL_KEY[event.action])
        : event.action;
  }
}
