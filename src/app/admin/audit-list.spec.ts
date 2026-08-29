import { TestBed } from '@angular/core/testing';
import { AuditList } from './audit-list';
import type { AuditEvent } from './audit.model';

describe('AuditList', () => {
  function anEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
    return {
      action: 'USER_INVITED',
      actorUserId: 'a1',
      actorEmail: 'luffy@onepiece.local',
      targetUserId: 't1',
      targetEmail: 'usopp@onepiece.local',
      occurredAt: '2026-08-23T10:00:00Z',
      ...overrides,
    };
  }

  it('renders a human label, actor and target for each event', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.componentRef.setInput('events', [anEvent()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Invited User');
    expect(root.textContent).toContain('luffy@onepiece.local');
    expect(root.textContent).toContain('usopp@onepiece.local');
  });

  it('falls back to the raw action code for an unmapped action', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.componentRef.setInput('events', [anEvent({ action: 'SOMETHING_NEW' })]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('SOMETHING_NEW');
  });

  it('shows the given empty message when there are no events', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.componentRef.setInput('events', []);
    fixture.componentRef.setInput('emptyMessage', 'Nothing logged yet.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Nothing logged yet.');
  });
});
