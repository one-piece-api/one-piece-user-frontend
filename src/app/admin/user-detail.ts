import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { hasErrorCode } from '../shared/http/api-error';
import { MascotService } from '../shared/mascot/mascot';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { initialsOf } from '../shared/ui/initials';
import { Modal } from '../shared/ui/modal';
import {
  STATUS_LABEL,
  STATUS_TONE,
  statusBorderClass,
  type AdminUserSummary,
  type RolePermissions,
} from './admin-user.model';
import { AuditList } from './audit-list';
import type { AuditEvent } from './audit.model';
import { ResendInvitationService } from './resend-invitation.service';

const USERS_ENDPOINT = '/api/users';
const ROLES_ENDPOINT = '/api/roles';
const AUDIT_ENDPOINT = '/api/audit';
const LAST_ADMINISTRATOR_ERROR_CODE = 'USER_LAST_ADMINISTRATOR';
const LAST_ROLE_ERROR_CODE = 'USER_LAST_ROLE';

/** Which confirmation dialog (UF-IDU-13/14) is currently open, if any. */
type AccessAction = 'revoke' | 'reactivate';

interface PageResponse<T> {
  content: T[];
}

/**
 * The role editor (Step 6, UF-IDU-15/16) - the first per-user route in this app (see
 * `docs/adr/0006-role-update-endpoints-and-user-detail-view.md`). Fetches its own data by
 * `userId` (a `withComponentInputBinding()` route param, `app.config.ts`) rather than
 * relying on data the Crew Manifest list already has in memory, so the route works on a
 * direct visit or a refresh too. Also hosts the revoke-access/reactivate actions (Step 7,
 * UF-IDU-13/14) - account-level, so they live alongside identity/status rather than in the
 * per-role list below.
 */
@Component({
  selector: 'app-admin-user-detail',
  templateUrl: './user-detail.html',
  imports: [Card, Badge, RouterLink, Modal, AuditList],
})
export class AdminUserDetail {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly resendInvitationService = inject(ResendInvitationService);

  readonly userId = input.required<string>();

  protected readonly user = httpResource<AdminUserSummary>(
    () => `${USERS_ENDPOINT}/${this.userId()}`,
  );

  /**
   * This crewmate's own slice of the Step 17 audit trail, reusing its row rendering. Not
   * gated client-side on `audit:read`: this whole route already requires `users:read`,
   * and today's only role with `users:read` (ADMIN) also has `audit:read` (ADR-0007's
   * mapping) - a real split would need its own decision, not a speculative check.
   */
  protected readonly auditEvents = httpResource<PageResponse<AuditEvent>>(
    () => `${AUDIT_ENDPOINT}?userId=${this.userId()}`,
  );

  /** Same registry the Crew Manifest reads (ADR-0007) - unioned below into this user's permissions. */
  protected readonly roleRegistry = httpResource<RolePermissions[]>(() => ROLES_ENDPOINT);

  /** The union of every permission granted by any role this user currently holds, deduplicated. */
  protected readonly effectivePermissions = computed(() => {
    const roles = this.user.value()?.roles;
    const registry = this.roleRegistry.value();
    if (!roles || !registry) {
      return null;
    }
    const permissions = new Set<string>();
    for (const entry of registry) {
      if (roles.includes(entry.role)) {
        for (const permission of entry.permissions) {
          permissions.add(permission);
        }
      }
    }
    return [...permissions].sort();
  });

  /** Every role in the registry (ADR-0012: roles are dynamic, not a fixed set). */
  protected readonly assignableRoles = computed(
    () => this.roleRegistry.value()?.map((entry) => entry.role) ?? [],
  );
  protected readonly statusTone = STATUS_TONE;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly navClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');
  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly initials = initialsOf;
  protected readonly statusBorderClass = statusBorderClass;

  protected readonly pendingRole = signal<string | null>(null);
  protected readonly confirmingAction = signal<AccessAction | null>(null);
  protected readonly accessActionPending = signal(false);
  protected readonly resendingInvitation = signal(false);

  /** The assignable roles this crewmate does not already hold - offered as "add a role" chips. */
  protected availableRoles(user: AdminUserSummary): readonly string[] {
    return this.assignableRoles().filter((role) => !user.roles.includes(role));
  }

  protected async assignRole(user: AdminUserSummary, role: string): Promise<void> {
    this.pendingRole.set(role);
    try {
      await firstValueFrom(
        this.http.put<void>(`${USERS_ENDPOINT}/${user.userId}/roles/${role}`, {}),
      );
      this.mascotService.show(`Granted ${role} to ${user.username}!`, 'success');
      this.user.reload();
      this.auditEvents.reload();
    } catch (err) {
      this.handleRoleError(err, user);
    } finally {
      this.pendingRole.set(null);
    }
  }

  protected async revokeRole(user: AdminUserSummary, role: string): Promise<void> {
    this.pendingRole.set(role);
    try {
      await firstValueFrom(
        this.http.delete<void>(`${USERS_ENDPOINT}/${user.userId}/roles/${role}`),
      );
      this.mascotService.show(`Revoked ${role} from ${user.username}!`, 'success');
      this.user.reload();
      this.auditEvents.reload();
    } catch (err) {
      this.handleRoleError(err, user);
    } finally {
      this.pendingRole.set(null);
    }
  }

  private handleRoleError(err: unknown, user: AdminUserSummary): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (hasErrorCode(err, LAST_ADMINISTRATOR_ERROR_CODE)) {
      this.mascotService.show(
        'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        'error',
      );
    } else if (hasErrorCode(err, LAST_ROLE_ERROR_CODE)) {
      this.mascotService.show(
        `Arrr! ${user.username} needs at least one role - grant another before revoking this one.`,
        'error',
      );
    } else if (err.status === 404) {
      this.mascotService.show(`Arrr! ${user.username} be gone from the manifest.`, 'error');
      this.user.reload();
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
  }

  protected async resendInvitation(user: AdminUserSummary): Promise<void> {
    this.resendingInvitation.set(true);
    const shouldReload = await this.resendInvitationService.resend(user);
    if (shouldReload) {
      this.user.reload();
      this.auditEvents.reload();
    }
    this.resendingInvitation.set(false);
  }

  protected async confirmAccessAction(user: AdminUserSummary): Promise<void> {
    const action = this.confirmingAction();
    if (action === null) {
      return;
    }
    this.accessActionPending.set(true);
    try {
      if (action === 'revoke') {
        await firstValueFrom(
          this.http.post<void>(`${USERS_ENDPOINT}/${user.userId}/revoke-access`, {}),
        );
        this.mascotService.show(`${user.username}'s access has been revoked!`, 'success');
      } else {
        await firstValueFrom(
          this.http.post<void>(`${USERS_ENDPOINT}/${user.userId}/reactivate`, {}),
        );
        this.mascotService.show(`${user.username} may sail with the crew once more!`, 'success');
      }
      this.user.reload();
      this.auditEvents.reload();
    } catch (err) {
      this.handleAccessError(err, user);
    } finally {
      this.accessActionPending.set(false);
      this.confirmingAction.set(null);
    }
  }

  private handleAccessError(err: unknown, user: AdminUserSummary): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (hasErrorCode(err, LAST_ADMINISTRATOR_ERROR_CODE)) {
      this.mascotService.show(
        'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        'error',
      );
    } else if (err.status === 404) {
      this.mascotService.show(`Arrr! ${user.username} be gone from the manifest.`, 'error');
      this.user.reload();
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
  }
}
