import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService } from '../shared/mascot/mascot';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { initialsOf } from '../shared/ui/initials';
import { Modal } from '../shared/ui/modal';
import { PageHeader } from '../shared/ui/page-header';
import {
  STATUS_LABEL_KEY,
  STATUS_TONE,
  statusBorderClass,
  type AccountStatus,
  type AdminUserSummary,
  type RolePermissions,
} from './admin-user.model';
import { InviteUserForm } from './invite-user-form';

const USERS_ENDPOINT = '/api/users';
const ROLES_ENDPOINT = '/api/roles';

type RoleFilter = 'ALL' | string;
type StatusFilter = 'ALL' | AccountStatus;

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
  imports: [Card, Badge, Modal, InviteUserForm, RouterLink, PageHeader, TranslocoPipe],
})
export class AdminUserList {
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

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
    return `${USERS_ENDPOINT}?${params.toString()}`;
  });

  /**
   * Powers the read-only "Roles &amp; Permissions" panel below the manifest (ADR-0007),
   * the role filter, and the invite form's role picker - one fetch, three consumers.
   */
  protected readonly roleRegistry = httpResource<RolePermissions[]>(() => ROLES_ENDPOINT);

  protected readonly showInviteModal = signal(false);

  protected readonly statusTone = STATUS_TONE;
  protected readonly statusLabelKey = STATUS_LABEL_KEY;
  protected readonly assignableRoles = computed(
    () => this.roleRegistry.value()?.map((entry) => entry.role) ?? [],
  );
  protected readonly statuses = Object.keys(STATUS_LABEL_KEY) as AccountStatus[];
  protected readonly navClasses = buttonClasses('secondary');
  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly initials = initialsOf;
  protected readonly statusBorderClass = statusBorderClass;
  protected readonly pageArrowClasses =
    'cursor-pointer rounded-lg border-2 border-ocean-900/15 bg-parchment-100 px-3 py-2 font-heading text-sm font-bold text-ocean-700 shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-ocean-700/40 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-sm';

  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(
    () => this.users.hasValue() && this.page() + 1 < this.users.value().totalPages,
  );

  /** "1–20 of 37", framing the current page against the crew's real total. */
  protected readonly range = computed(() => {
    this.transloco.activeLang();
    if (!this.users.hasValue()) {
      return null;
    }
    const current = this.users.value();
    if (current.totalElements === 0) {
      return null;
    }
    const start = current.page * current.size + 1;
    const end = start + current.content.length - 1;
    return this.transloco.translate('common.range', { start, end, total: current.totalElements });
  });

  constructor() {
    effect(() => {
      if (this.users.error()) {
        this.mascotService.show(this.transloco.translate('users.loadError'), 'error');
      }
    });
  }

  protected previousPage(): void {
    this.page.update((current) => Math.max(0, current - 1));
  }

  protected nextPage(): void {
    this.page.update((current) => current + 1);
  }

  protected goToPage(pageNumber: number): void {
    this.page.set(pageNumber);
  }

  protected pageNumbers(totalPages: number): number[] {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  /** Highlights the current page among the numbered pagination buttons. */
  protected pageButtonClasses(pageNumber: number): string {
    const base =
      'flex size-9 cursor-pointer items-center justify-center rounded-lg font-display text-sm font-bold shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0';
    return this.page() === pageNumber
      ? `${base} bg-treasure-500 text-ocean-950`
      : `${base} bg-parchment-100 text-ocean-900 ring-1 ring-ocean-900/15 hover:ring-ocean-700/40`;
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
}
