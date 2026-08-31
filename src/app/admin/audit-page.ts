import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MascotService } from '../shared/mascot/mascot';
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
  imports: [Card, PageHeader, AuditList, AuditPagination],
})
export class AdminAuditPage {
  private readonly mascotService = inject(MascotService);

  protected readonly page = signal(0);

  protected readonly events = httpResource<PageResponse<AuditEvent>>(
    () => `${AUDIT_ENDPOINT}?page=${this.page()}`,
  );

  /** "1–20 of 37", framing the current page against the full trail. */
  protected readonly range = computed(() => {
    if (!this.events.hasValue()) {
      return null;
    }
    const current = this.events.value();
    if (current.totalElements === 0) {
      return null;
    }
    const start = current.page * current.size + 1;
    const end = start + current.content.length - 1;
    return `${start}–${end} of ${current.totalElements}`;
  });

  constructor() {
    effect(() => {
      if (this.events.error()) {
        this.mascotService.show(
          "Arrr! Could not load the ship's log — try again in a moment.",
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

  protected goToPage(pageNumber: number): void {
    this.page.set(pageNumber);
  }
}
