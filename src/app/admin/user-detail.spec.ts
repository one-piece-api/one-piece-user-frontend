import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MascotService } from '../shared/mascot/mascot';
import type { RolePermissions } from './admin-user.model';
import type { AuditEvent } from './audit.model';
import { AdminUserDetail } from './user-detail';

const DEFAULT_ROLE_REGISTRY: RolePermissions[] = [
  {
    role: 'ADMIN',
    permissions: ['users:read', 'users:invite', 'roles:read', 'roles:assign', 'access:write', 'audit:read'],
  },
  { role: 'REVIEWER', permissions: ['docs:read', 'docs:review'] },
  { role: 'EDITOR', permissions: ['docs:read', 'docs:write'] },
];

// jsdom doesn't implement <dialog>'s showModal()/close() yet - every real browser this app
// targets does, so this is purely a test-environment gap, polyfilled here rather than
// worked around in Modal itself.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

describe('AdminUserDetail', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserDetail],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createWithUserId(
    userId: string,
    roleRegistry: RolePermissions[] = DEFAULT_ROLE_REGISTRY,
    auditEvents: AuditEvent[] = [],
  ) {
    const fixture = TestBed.createComponent(AdminUserDetail);
    fixture.componentRef.setInput('userId', userId);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush(roleRegistry);
    httpTesting.expectOne(`/api/audit?userId=${userId}`).flush({ content: auditEvents });
    return fixture;
  }

  it('shows the crewmate identity, status and current roles', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('nami');
    expect(root.textContent).toContain('nami@onepiece.local');
    expect(root.textContent).toContain('Active');
    expect(root.textContent).toContain('EDITOR');
  });

  it('shows the union of every held roles permissions, with duplicates removed', async () => {
    const fixture = createWithUserId('1', [
      { role: 'REVIEWER', permissions: ['docs:read', 'docs:review'] },
      { role: 'EDITOR', permissions: ['docs:read', 'docs:write'] },
    ]);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['REVIEWER', 'EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const heading = Array.from(root.querySelectorAll('h3')).find(
      (h) => h.textContent?.trim() === 'Effective Permissions',
    );
    const panel = heading!.nextElementSibling as HTMLElement;
    const permissionChips = Array.from(panel.querySelectorAll('span')).map((s) =>
      s.textContent?.trim(),
    );
    expect(permissionChips).toEqual(['docs:read', 'docs:review', 'docs:write']);
  });

  it('offers to add a role the crewmate does not hold and to revoke one it does', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('+ ADMIN');
    expect(root.querySelector('button[aria-label="Revoke role EDITOR"]')).toBeTruthy();
  });

  it('grants a role and reloads the crewmate', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const grantButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '+ ADMIN',
    );
    grantButton!.click();
    fixture.detectChanges();

    const putRequest = httpTesting.expectOne('/api/users/1/roles/ADMIN');
    expect(putRequest.request.method).toBe('PUT');
    putRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: 'Granted ADMIN to nami!', tone: 'success' }),
    );

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR', 'ADMIN'],
    });
    httpTesting.expectOne('/api/audit?userId=1').flush({
      content: [
        {
          action: 'ROLE_ASSIGNED',
          actorUserId: 'a1',
          actorEmail: 'luffy@onepiece.local',
          targetUserId: '1',
          targetEmail: 'nami@onepiece.local',
          occurredAt: '2026-08-23T10:00:00Z',
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Granted Role');
  });

  it('revokes a role and reloads the crewmate', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeButton = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Revoke role EDITOR"]',
    );
    revokeButton!.click();
    fixture.detectChanges();

    const deleteRequest = httpTesting.expectOne('/api/users/1/roles/EDITOR');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: 'Revoked EDITOR from nami!', tone: 'success' }),
    );

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: [],
    });
    httpTesting.expectOne('/api/audit?userId=1').flush({ content: [] });
  });

  it('shows a themed error toast when revoking would leave zero administrators', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'luffy',
      email: 'luffy@onepiece.local',
      status: 'ACTIVE',
      roles: ['ADMIN'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeButton = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Revoke role ADMIN"]',
    );
    revokeButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/users/1/roles/ADMIN')
      .flush(
        { detail: 'Cannot remove the ADMIN role', errorCode: 'USER_LAST_ADMINISTRATOR' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        tone: 'error',
      }),
    );
  });

  it('shows a themed error toast when revoking would leave the crewmate with no roles', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeButton = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Revoke role EDITOR"]',
    );
    revokeButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/users/1/roles/EDITOR')
      .flush(
        { detail: 'Cannot remove the EDITOR role', errorCode: 'USER_LAST_ROLE' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Arrr! nami needs at least one role - grant another before revoking this one.',
        tone: 'error',
      }),
    );
  });

  it('shows Revoke Access for an active crewmate and Reactivate for a disabled one', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    let root = fixture.nativeElement as HTMLElement;
    let buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Revoke Access');
    expect(buttons).not.toContain('Reactivate');

    fixture.componentRef.setInput('userId', '2');
    fixture.detectChanges();
    httpTesting.expectOne('/api/users/2').flush({
      userId: '2',
      username: 'chopper',
      email: 'chopper@onepiece.local',
      status: 'DISABLED',
      roles: ['EDITOR'],
    });
    httpTesting.expectOne('/api/audit?userId=2').flush({ content: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    root = fixture.nativeElement as HTMLElement;
    buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Reactivate');
    expect(buttons).not.toContain('Revoke Access');
  });

  it('shows Resend Invitation only for a crewmate with an expired invitation', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'usopp',
      email: 'usopp@onepiece.local',
      status: 'INVITATION_EXPIRED',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Resend Invitation');
    expect(buttons).not.toContain('Revoke Access');
    expect(buttons).not.toContain('Reactivate');
  });

  it('resends an invitation and reloads the crewmate', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'usopp',
      email: 'usopp@onepiece.local',
      status: 'INVITATION_EXPIRED',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const resendButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Resend Invitation',
    );
    resendButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/users/1/resend-invitation').flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Resent the invitation to usopp@onepiece.local!',
        tone: 'success',
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'usopp',
      email: 'usopp@onepiece.local',
      status: 'PENDING',
      roles: ['EDITOR'],
    });
    httpTesting.expectOne('/api/audit?userId=1').flush({ content: [] });
  });

  it('shows a themed error toast when the invitation email cannot be delivered', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'usopp',
      email: 'usopp@onepiece.local',
      status: 'INVITATION_EXPIRED',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const resendButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Resend Invitation',
    );
    resendButton!.click();
    fixture.detectChanges();

    httpTesting
      .expectOne('/api/users/1/resend-invitation')
      .flush(
        { detail: 'Could not send the invitation email', errorCode: 'USER_EMAIL_DELIVERY_FAILED' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Arrr! Could not resend the invitation to usopp@onepiece.local - the message bird got lost.',
        tone: 'error',
      }),
    );
  });

  it('revokes access after confirmation and reloads the crewmate', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeAccessButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke Access',
    );
    revokeAccessButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirm',
    );
    expect(confirmButton).toBeTruthy();
    confirmButton!.click();
    fixture.detectChanges();

    const postRequest = httpTesting.expectOne('/api/users/1/revoke-access');
    expect(postRequest.request.method).toBe('POST');
    postRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: "nami's access has been revoked!", tone: 'success' }),
    );

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'DISABLED',
      roles: ['EDITOR'],
    });
    httpTesting.expectOne('/api/audit?userId=1').flush({ content: [] });
  });

  it('cancelling the confirmation makes no request', async () => {
    const fixture = createWithUserId('1');

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeAccessButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke Access',
    );
    revokeAccessButton!.click();
    fixture.detectChanges();

    const cancelButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    );
    cancelButton!.click();
    fixture.detectChanges();

    httpTesting.expectNone('/api/users/1/revoke-access');
  });

  it('reactivates a disabled crewmate after confirmation', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'chopper',
      email: 'chopper@onepiece.local',
      status: 'DISABLED',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const reactivateButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reactivate',
    );
    reactivateButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirm',
    );
    confirmButton!.click();
    fixture.detectChanges();

    const postRequest = httpTesting.expectOne('/api/users/1/reactivate');
    expect(postRequest.request.method).toBe('POST');
    postRequest.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'chopper may sail with the crew once more!',
        tone: 'success',
      }),
    );

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'chopper',
      email: 'chopper@onepiece.local',
      status: 'PENDING',
      roles: ['EDITOR'],
    });
    httpTesting.expectOne('/api/audit?userId=1').flush({ content: [] });
  });

  it('shows a themed error toast when revoking access would leave zero administrators', async () => {
    const fixture = createWithUserId('1');
    const mascotService = TestBed.inject(MascotService);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'luffy',
      email: 'luffy@onepiece.local',
      status: 'ACTIVE',
      roles: ['ADMIN'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const revokeAccessButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Revoke Access',
    );
    revokeAccessButton!.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirm',
    );
    confirmButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/users/1/revoke-access').flush(
      {
        detail: 'Cannot leave the realm with zero ADMIN users',
        errorCode: 'USER_LAST_ADMINISTRATOR',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        tone: 'error',
      }),
    );
  });

  it("shows this crewmate's own slice of the audit trail", async () => {
    const auditEvents: AuditEvent[] = [
      {
        action: 'ROLE_ASSIGNED',
        actorUserId: 'a1',
        actorEmail: 'luffy@onepiece.local',
        targetUserId: '1',
        targetEmail: 'nami@onepiece.local',
        occurredAt: '2026-08-23T10:00:00Z',
      },
    ];
    const fixture = createWithUserId('1', DEFAULT_ROLE_REGISTRY, auditEvents);

    httpTesting.expectOne('/api/users/1').flush({
      userId: '1',
      username: 'nami',
      email: 'nami@onepiece.local',
      status: 'ACTIVE',
      roles: ['EDITOR'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain("Ship's Log");
    expect(root.textContent).toContain('Granted Role');
    expect(root.textContent).toContain('luffy@onepiece.local');
    expect(root.textContent).toContain('nami@onepiece.local');
  });
});
