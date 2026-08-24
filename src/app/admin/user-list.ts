import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ToastService } from '../shared/toast/toast';
import { Badge, type BadgeTone } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { Modal } from '../shared/ui/modal';
import { InviteUserForm } from './invite-user-form';

const ADMIN_USERS_ENDPOINT = '/api/admin/users';

type AccountStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

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
  DISABLED: 'neutral',
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  DISABLED: 'Disabled',
};

/** The admin user listing (Step 3, UF-IDU-17) plus the Step 4 invite form. */
@Component({
  selector: 'app-admin-user-list',
  templateUrl: './user-list.html',
  imports: [Card, Badge, Modal, InviteUserForm],
})
export class AdminUserList {
  private readonly toastService = inject(ToastService);

  protected readonly page = signal(0);
  protected readonly users = httpResource<PageResponse<AdminUserSummary>>(
    () => `${ADMIN_USERS_ENDPOINT}?page=${this.page()}`,
  );

  protected readonly showInviteModal = signal(false);

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
        this.toastService.show('Unable to load the crew manifest. Please try again.', 'error');
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
}
