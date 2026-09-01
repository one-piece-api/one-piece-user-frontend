import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { formatAuditMessage, type AuditEvent, type Translate } from './audit.model';

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
  let translate: Translate;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    const transloco = TestBed.inject(TranslocoService);
    translate = (key, params) => transloco.translate(key, params);
  });

  it('describes an invitation with the role(s) it carried', () => {
    const message = formatAuditMessage(
      anEvent({
        action: 'USER_INVITED',
        targetEmail: 'franky@onepiece.local',
        targetLabel: 'EDITOR',
      }),
      translate,
    );

    expect(message).toBe('Invitation sent to franky@onepiece.local as EDITOR');
  });

  it('describes a resent invitation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'INVITATION_RESENT', targetEmail: 'brook@onepiece.local' }),
      translate,
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
      translate,
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
      translate,
    );

    expect(message).toBe('Role EDITOR revoked from usopp@onepiece.local');
  });

  it('describes an access revocation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ACCESS_REVOKED', targetEmail: 'usopp@onepiece.local' }),
      translate,
    );

    expect(message).toBe('Access revoked for usopp@onepiece.local');
  });

  it('describes an access reactivation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ACCESS_REACTIVATED', targetEmail: 'usopp@onepiece.local' }),
      translate,
    );

    expect(message).toBe('Access reactivated for usopp@onepiece.local');
  });

  it('describes a role created in the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ROLE_CREATED', targetLabel: 'NAVIGATOR' }),
      translate,
    );

    expect(message).toBe('Role NAVIGATOR created');
  });

  it('describes a role deleted from the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'ROLE_DELETED', targetLabel: 'NAVIGATOR' }),
      translate,
    );

    expect(message).toBe('Role NAVIGATOR deleted');
  });

  it('describes a permission created in the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_CREATED', targetLabel: 'docs:approve' }),
      translate,
    );

    expect(message).toBe('Permission docs:approve created');
  });

  it('describes a permission deleted from the catalog', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_DELETED', targetLabel: 'docs:approve' }),
      translate,
    );

    expect(message).toBe('Permission docs:approve deleted');
  });

  it('splits the role/permission pair for an assignment', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_ASSIGNED_TO_ROLE', targetLabel: 'ADMIN <- roles:manage' }),
      translate,
    );

    expect(message).toBe('Permission roles:manage granted to ADMIN');
  });

  it('splits the role/permission pair for a revocation', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_REVOKED_FROM_ROLE', targetLabel: 'EDITOR <- docs:write' }),
      translate,
    );

    expect(message).toBe('Permission docs:write revoked from EDITOR');
  });

  it('falls back gracefully if the role/permission label is malformed', () => {
    const message = formatAuditMessage(
      anEvent({ action: 'PERMISSION_ASSIGNED_TO_ROLE', targetLabel: 'not-well-formed' }),
      translate,
    );

    expect(message).toBe('Permission granted (not-well-formed)');
  });

  it('falls back to the raw action code for an unmapped action', () => {
    const message = formatAuditMessage(anEvent({ action: 'SOMETHING_NEW' }), translate);

    expect(message).toBe('SOMETHING_NEW');
  });
});
