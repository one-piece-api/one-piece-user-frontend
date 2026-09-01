import { formatAuditMessage, type AuditEvent } from './audit.model';

function anEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    action: 'USER_INVITED',
    actorUserId: 'a1',
    actorEmail: 'luffy@onepiece.local',
    occurredAt: '2026-08-23T10:00:00Z',
    ...overrides,
  };
}

describe('formatAuditMessage', () => {
  it('describes an invitation with the role(s) it carried', () => {
    const message = formatAuditMessage(
      anEvent({
        action: 'USER_INVITED',
        targetEmail: 'franky@onepiece.local',
        targetLabel: 'EDITOR',
      }),
    );

    expect(message).toBe('Invitation sent to franky@onepiece.local as EDITOR');
  });

  it('describes a resent invitation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'INVITATION_RESENT', targetEmail: 'brook@onepiece.local' }),
    );

    expect(message).toBe('Invitation resent to brook@onepiece.local');
  });

  it('describes a role assignment by name, not just "some role"', () => {
    const message = formatAuditMessage(
      anEvent({
        action: 'ROLE_ASSIGNED',
        targetEmail: 'robin@onepiece.local',
        targetLabel: 'REVIEWER',
      }),
    );

    expect(message).toBe('Role REVIEWER assigned to robin@onepiece.local');
  });

  it('describes a role revocation by name', () => {
    const message = formatAuditMessage(
      anEvent({
        action: 'ROLE_REVOKED',
        targetEmail: 'usopp@onepiece.local',
        targetLabel: 'EDITOR',
      }),
    );

    expect(message).toBe('Role EDITOR revoked from usopp@onepiece.local');
  });

  it('describes an access revocation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ACCESS_REVOKED', targetEmail: 'usopp@onepiece.local' }),
    );

    expect(message).toBe('Access revoked for usopp@onepiece.local');
  });

  it('describes an access reactivation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ACCESS_REACTIVATED', targetEmail: 'usopp@onepiece.local' }),
    );

    expect(message).toBe('Access reactivated for usopp@onepiece.local');
  });

  it('describes a role created in the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ROLE_CREATED', targetLabel: 'NAVIGATOR' }),
    );

    expect(message).toBe('Role NAVIGATOR created');
  });

  it('describes a role deleted from the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ROLE_DELETED', targetLabel: 'NAVIGATOR' }),
    );

    expect(message).toBe('Role NAVIGATOR deleted');
  });

  it('describes a permission created in the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_CREATED', targetLabel: 'docs:approve' }),
    );

    expect(message).toBe('Permission docs:approve created');
  });

  it('describes a permission deleted from the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_DELETED', targetLabel: 'docs:approve' }),
    );

    expect(message).toBe('Permission docs:approve deleted');
  });

  it('splits the role/permission pair for an assignment', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_ASSIGNED_TO_ROLE', targetLabel: 'ADMIN <- roles:manage' }),
    );

    expect(message).toBe('Permission roles:manage granted to ADMIN');
  });

  it('splits the role/permission pair for a revocation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_REVOKED_FROM_ROLE', targetLabel: 'EDITOR <- docs:write' }),
    );

    expect(message).toBe('Permission docs:write revoked from EDITOR');
  });

  it('falls back gracefully if the role/permission label is malformed', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_ASSIGNED_TO_ROLE', targetLabel: 'not-well-formed' }),
    );

    expect(message).toBe('Permission granted (not-well-formed)');
  });

  it('falls back to the raw action code for an unmapped action', () => {
    const message = formatAuditMessage(anEvent({ action: 'SOMETHING_NEW' }));

    expect(message).toBe('SOMETHING_NEW');
  });
});
