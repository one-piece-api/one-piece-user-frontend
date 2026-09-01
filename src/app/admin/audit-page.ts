import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService } from '../shared/mascot/mascot';
import { AuditFilters } from './audit-filters';
import { AuditList } from './audit-list';
import { AuditPagination } from './audit-pagination';
import type { AuditEvent } from './audit.model';
import { Card } from '../shared/ui/card';
import { PageHeader } from '../shared/ui/page-header';

const AUDIT_ENDPOINT = '/api/audit';

interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** The full audit trail (Step 17, UF-IDU-17's read path, permission-gated on `audit:read`). */
@Component({
  selector: 'app-admin-audit-page',
  templateUrl: './audit-page.html',
  imports: [Card, PageHeader, AuditFilters, AuditList, AuditPagination, TranslocoPipe],
})
export class AdminAuditPage {
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

  protected readonly page = signal(0);
  protected readonly selectedActions = signal<ReadonlySet<string>>(new Set());
  protected readonly actorEmail = signal('');
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);

  protected readonly hasActiveFilters = computed(
    () =>
      this.selectedActions().size > 0 ||
      this.actorEmail() !== '' ||
      this.dateFrom() !== null ||
      this.dateTo() !== null,
  );

  protected readonly events = httpResource<PageResponse<AuditEvent>>(() => {
    const params = new URLSearchParams({ page: String(this.page()) });
    for (const action of this.selectedActions()) {
      params.append('actions', action);
    }
    if (this.actorEmail()) {
      params.set('actorEmail', this.actorEmail());
    }
    const from = this.dateFrom();
    if (from) {
      params.set('from', from);
    }
    const to = this.dateTo();
    if (to) {
      params.set('to', to);
    }
    return `${AUDIT_ENDPOINT}?${params.toString()}`;
  });

  /** Every actor who has ever recorded an event - fetched once, independent of the current filters. */
  protected readonly actorOptions = httpResource<string[]>(() => `${AUDIT_ENDPOINT}/actors`);

  /** "1–20 of 37", framing the current page against the full trail. */
  protected readonly range = computed(() => {
    this.transloco.activeLang();
    if (!this.events.hasValue()) {
      return null;
    }
    const current = this.events.value();
    if (current.totalElements === 0) {
      return null;
    }
    const start = current.page * current.size + 1;
    const end = start + current.content.length - 1;
    return this.transloco.translate('common.range', { start, end, total: current.totalElements });
  });

  constructor() {
    effect(() => {
      if (this.events.error()) {
        this.mascotService.show(this.transloco.translate('audit.loadError'), 'error');
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

  protected toggleAction(action: string): void {
    this.selectedActions.update((current) => {
      const next = new Set(current);
      if (next.has(action)) {
        next.delete(action);
      } else {
        next.add(action);
      }
      return next;
    });
    this.page.set(0);
  }

  protected setActorEmail(value: string): void {
    this.actorEmail.set(value);
    this.page.set(0);
  }

  protected setDateFrom(value: string | null): void {
    this.dateFrom.set(value);
    this.page.set(0);
  }

  protected setDateTo(value: string | null): void {
    this.dateTo.set(value);
    this.page.set(0);
  }

  protected clearFilters(): void {
    this.selectedActions.set(new Set());
    this.actorEmail.set('');
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.page.set(0);
  }
}
