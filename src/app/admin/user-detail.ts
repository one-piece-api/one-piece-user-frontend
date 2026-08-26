import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { hasErrorCode } from '../shared/http/api-error';
import { ToastService } from '../shared/toast/toast';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { Modal } from '../shared/ui/modal';
import {
  ASSIGNABLE_ROLES,
  STATUS_LABEL,
  STATUS_TONE,
  type AdminUserSummary,
} from './admin-user.model';

const ADMIN_USERS_ENDPOINT = '/api/admin/users';
const LAST_ADMINISTRATOR_ERROR_CODE = 'USER_LAST_ADMINISTRATOR';
const LAST_ROLE_ERROR_CODE = 'USER_LAST_ROLE';

/** Which confirmation dialog (UF-IDU-13/14) is currently open, if any. */
type AccessAction = 'revoke' | 'reactivate';

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
  imports: [Card, Badge, RouterLink, Modal],
})
export class AdminUserDetail {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);

  readonly userId = input.required<string>();

  protected readonly user = httpResource<AdminUserSummary>(
    () => `${ADMIN_USERS_ENDPOINT}/${this.userId()}`,
  );

  protected readonly assignableRoles = ASSIGNABLE_ROLES;
  protected readonly statusTone = STATUS_TONE;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly navClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');
  protected readonly primaryClasses = buttonClasses('primary');

  protected readonly pendingRole = signal<string | null>(null);
  protected readonly confirmingAction = signal<AccessAction | null>(null);
  protected readonly accessActionPending = signal(false);

  protected async assignRole(user: AdminUserSummary, role: string): Promise<void> {
    this.pendingRole.set(role);
    try {
      await firstValueFrom(
        this.http.put<void>(`${ADMIN_USERS_ENDPOINT}/${user.userId}/roles/${role}`, {}),
      );
      this.toastService.show(`Granted ${role} to ${user.username}!`, 'success');
      this.user.reload();
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
        this.http.delete<void>(`${ADMIN_USERS_ENDPOINT}/${user.userId}/roles/${role}`),
      );
      this.toastService.show(`Revoked ${role} from ${user.username}!`, 'success');
      this.user.reload();
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
      this.toastService.show(
        'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        'error',
      );
    } else if (hasErrorCode(err, LAST_ROLE_ERROR_CODE)) {
      this.toastService.show(
        `Arrr! ${user.username} needs at least one role - grant another before revoking this one.`,
        'error',
      );
    } else if (err.status === 404) {
      this.toastService.show(`Arrr! ${user.username} be gone from the manifest.`, 'error');
      this.user.reload();
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
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
          this.http.post<void>(`${ADMIN_USERS_ENDPOINT}/${user.userId}/revoke-access`, {}),
        );
        this.toastService.show(`${user.username}'s access has been revoked!`, 'success');
      } else {
        await firstValueFrom(
          this.http.post<void>(`${ADMIN_USERS_ENDPOINT}/${user.userId}/reactivate`, {}),
        );
        this.toastService.show(`${user.username} may sail with the crew once more!`, 'success');
      }
      this.user.reload();
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
      this.toastService.show(
        'Arrr! At least one ADMIN must remain in the crew - this one cannot be revoked.',
        'error',
      );
    } else if (err.status === 404) {
      this.toastService.show(`Arrr! ${user.username} be gone from the manifest.`, 'error');
      this.user.reload();
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
  }
}
