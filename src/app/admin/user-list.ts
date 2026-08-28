import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorOf } from '../shared/http/api-error';
import { ToastService } from '../shared/toast/toast';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { Modal } from '../shared/ui/modal';
import {
  ASSIGNABLE_ROLES,
  STATUS_LABEL,
  STATUS_TONE,
  type AccountStatus,
  type AdminUserSummary,
  type RolePermissions,
} from './admin-user.model';
import { InviteUserForm } from './invite-user-form';

const ADMIN_USERS_ENDPOINT = '/api/admin/users';
const ADMIN_ROLES_ENDPOINT = '/api/admin/roles';

type RoleFilter = 'ALL' | (typeof ASSIGNABLE_ROLES)[number];
type StatusFilter = 'ALL' | AccountStatus;
const INVITATION_NOT_RESENDABLE_ERROR_CODE = 'USER_INVITATION_NOT_RESENDABLE';
const EMAIL_DELIVERY_FAILED_ERROR_CODE = 'USER_EMAIL_DELIVERY_FAILED';

interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** The admin user listing (Step 3, UF-IDU-17) plus the Step 4 invite form. */
@Component({
  selector: 'app-admin-user-list',
  templateUrl: './user-list.html',
  imports: [Card, Badge, Modal, InviteUserForm, RouterLink],
})
export class AdminUserList {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);

  protected readonly page = signal(0);
  protected readonly query = signal('');
  protected readonly roleFilter = signal<RoleFilter>('ALL');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly hasActiveFilter = computed(
    () =>
      this.query().trim().length > 0 ||
      this.roleFilter() !== 'ALL' ||
      this.statusFilter() !== 'ALL',
  );

  protected readonly users = httpResource<PageResponse<AdminUserSummary>>(() => {
    const params = new URLSearchParams({ page: String(this.page()) });
    const query = this.query().trim();
    if (query) {
      params.set('q', query);
    }
    if (this.roleFilter() !== 'ALL') {
      params.set('role', this.roleFilter());
    }
    if (this.statusFilter() !== 'ALL') {
      params.set('status', this.statusFilter());
    }
    return `${ADMIN_USERS_ENDPOINT}?${params.toString()}`;
  });

  /** Powers the read-only "Roles &amp; Permissions" panel below the manifest (ADR-0007). */
  protected readonly roleRegistry = httpResource<RolePermissions[]>(() => ADMIN_ROLES_ENDPOINT);

  protected readonly showInviteModal = signal(false);
  protected readonly resendingUserId = signal<string | null>(null);

  protected readonly statusTone = STATUS_TONE;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly assignableRoles = ASSIGNABLE_ROLES;
  protected readonly statuses = Object.keys(STATUS_LABEL) as AccountStatus[];
  protected readonly navClasses = buttonClasses('secondary');
  protected readonly primaryClasses = buttonClasses('primary');

  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(
    () => this.users.hasValue() && this.page() + 1 < this.users.value().totalPages,
  );

  /** "1–20 of 37", framing the current page against the crew's real total. */
  protected readonly range = computed(() => {
    if (!this.users.hasValue()) {
      return null;
    }
    const current = this.users.value();
    if (current.totalElements === 0) {
      return null;
    }
    const start = current.page * current.size + 1;
    const end = start + current.content.length - 1;
    return `${start}–${end} of ${current.totalElements}`;
  });

  constructor() {
    effect(() => {
      if (this.users.error()) {
        this.toastService.show(
          'Arrr! Could not load the crew manifest — try again in a moment.',
          'error',
        );
      }
    });
  }

  protected previousPage(): void {
    this.page.update((current) => Math.max(0, current - 1));
  }

  protected nextPage(): void {
    this.page.update((current) => current + 1);
  }

  protected setQuery(value: string): void {
    this.query.set(value);
    this.page.set(0);
  }

  protected setRoleFilter(value: string): void {
    this.roleFilter.set(value as RoleFilter);
    this.page.set(0);
  }

  protected setStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.page.set(0);
  }

  protected resetFilters(): void {
    this.query.set('');
    this.roleFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.page.set(0);
  }

  /** A fresh invite lands as a PENDING row - no new concept, just re-fetch the current page. */
  protected onInvited(): void {
    this.users.reload();
    this.showInviteModal.set(false);
  }

  /**
   * UF-IDU-03: re-triggers Keycloak's invitation email for a row whose current invitation
   * has gone stale (INVITATION_EXPIRED) - the backend rejects this for a still-PENDING row
   * (a valid link is still outstanding) exactly like an already-ACTIVE one, so the button
   * is only ever shown for INVITATION_EXPIRED rows in the first place; the 409 branch below
   * is just the (rare) race where the row changed between page load and this click.
   */
  protected async resendInvitation(user: AdminUserSummary): Promise<void> {
    this.resendingUserId.set(user.userId);
    try {
      await firstValueFrom(
        this.http.post<void>(`${ADMIN_USERS_ENDPOINT}/${user.userId}/resend-invitation`, {}),
      );
      this.toastService.show(`Resent the invitation to ${user.email}!`, 'success');
      this.users.reload();
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (apiErrorOf(err)?.errorCode === INVITATION_NOT_RESENDABLE_ERROR_CODE) {
          this.toastService.show(
            `Arrr! ${user.email}'s invitation isn't resendable anymore — refresh the manifest.`,
            'error',
          );
          this.users.reload();
        } else if (err.status === 404) {
          this.toastService.show(`Arrr! ${user.email} be gone from the manifest.`, 'error');
          this.users.reload();
        } else if (apiErrorOf(err)?.errorCode === EMAIL_DELIVERY_FAILED_ERROR_CODE) {
          this.toastService.show(
            `Arrr! Could not resend the invitation to ${user.email} - the message bird got lost.`,
            'error',
          );
        }
        // 401/403/5xx already get a themed toast from apiErrorInterceptor.
      }
    } finally {
      this.resendingUserId.set(null);
    }
  }
}
