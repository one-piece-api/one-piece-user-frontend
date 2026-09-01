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

  it('shows who performed the action, for every event', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.componentRef.setInput('events', [anEvent()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('by luffy@onepiece.local');
  });

  it('renders a catalog action with no target user - the reported defect', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.componentRef.setInput('events', [
      anEvent({
        action: 'PERMISSION_REVOKED_FROM_ROLE',
        targetUserId: undefined,
        targetEmail: undefined,
        targetLabel: 'ADMIN <- users:read',
      }),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Permission users:read revoked from ADMIN');
    expect(root.textContent).toContain('by luffy@onepiece.local');
  });

  it('falls back to the raw action code for an unmapped action', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.componentRef.setInput('events', [anEvent({ action: 'SOMETHING_NEW' })]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('SOMETHING_NEW');
  });

  it('stacks the message and actor below their long-email overflow point instead of forcing them onto one nowrap row', () => {
    const fixture = TestBed.createComponent(AuditList);
    fixture.componentRef.setInput('events', [
      anEvent({ actorEmail: 'a-rather-long-crewmate-name@onepiece.local' }),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const actorSpan = Array.from(root.querySelectorAll('span')).find((s) =>
      s.textContent?.startsWith('by '),
    )!;
    // Wraps and shrinks below `sm`; only goes back to a single nowrap row at `sm` and up.
    expect(actorSpan.className).toContain('min-w-0');
    expect(actorSpan.className).toContain('break-words');
    expect(actorSpan.className).toContain('sm:whitespace-nowrap');
    expect(actorSpan.className).not.toMatch(/(^|\s)whitespace-nowrap(\s|$)/);

    const row = actorSpan.parentElement!;
    expect(row.className).toContain('flex-col');
    expect(row.className).toContain('sm:flex-row');
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
