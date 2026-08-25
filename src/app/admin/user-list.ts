import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorOf } from '../shared/http/api-error';
import { ToastService } from '../shared/toast/toast';
import { Badge, type BadgeTone } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { Modal } from '../shared/ui/modal';
import { InviteUserForm } from './invite-user-form';

const ADMIN_USERS_ENDPOINT = '/api/admin/users';
const INVITATION_NOT_RESENDABLE_ERROR_CODE = 'USER_INVITATION_NOT_RESENDABLE';
const EMAIL_DELIVERY_FAILED_ERROR_CODE = 'USER_EMAIL_DELIVERY_FAILED';

type AccountStatus = 'PENDING' | 'INVITATION_EXPIRED' | 'ACTIVE' | 'DISABLED';

interface AdminUserSummary {
  userId: string;
  email: string;
  status: AccountStatus;
  roles: string[];
}

interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const STATUS_TONE: Record<AccountStatus, BadgeTone> = {
  ACTIVE: 'success',
  PENDING: 'gold',
  INVITATION_EXPIRED: 'danger',
  DISABLED: 'neutral',
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  INVITATION_EXPIRED: 'Invite Expired',
  DISABLED: 'Disabled',
};

/** The admin user listing (Step 3, UF-IDU-17) plus the Step 4 invite form. */
@Component({
  selector: 'app-admin-user-list',
  templateUrl: './user-list.html',
  imports: [Card, Badge, Modal, InviteUserForm],
})
export class AdminUserList {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);

  protected readonly page = signal(0);
  protected readonly users = httpResource<PageResponse<AdminUserSummary>>(
    () => `${ADMIN_USERS_ENDPOINT}?page=${this.page()}`,
  );

  protected readonly showInviteModal = signal(false);
  protected readonly resendingUserId = signal<string | null>(null);

  protected readonly statusTone = STATUS_TONE;
  protected readonly statusLabel = STATUS_LABEL;
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
