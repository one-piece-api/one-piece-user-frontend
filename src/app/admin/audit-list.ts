import { Component, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Badge } from '../shared/ui/badge';
import {
  AUDIT_ACTION_LABEL_KEY,
  AUDIT_ACTION_TONE,
  formatAuditMessage,
  formatOccurredAt,
  type AuditEvent,
} from './audit.model';

/**
 * The audit row rendering shared by the Ship's Log page (Step 17, full trail) and the
 * User Detail page's per-user trail - one presentational piece, fed a different `events`
 * slice by each caller.
 */
@Component({
  selector: 'app-audit-list',
  templateUrl: './audit-list.html',
  imports: [Badge, TranslocoPipe],
})
export class AuditList {
  private readonly transloco = inject(TranslocoService);

  readonly events = input.required<AuditEvent[]>();
  /** A resolved, already-translated string - callers pass one via `| transloco` themselves
   * (see `audit-page.html`/`user-detail.html`), same as any other plain text input. */
  readonly emptyMessage = input(this.transloco.translate('audit.emptyAll'));

  protected readonly actionLabelKey = AUDIT_ACTION_LABEL_KEY;
  protected readonly actionTone = AUDIT_ACTION_TONE;

  protected formatOccurredAt(occurredAt: string): string {
    return formatOccurredAt(occurredAt, this.transloco.getActiveLang());
  }

  protected formatAuditMessage(event: AuditEvent): string {
    return formatAuditMessage(event, (key, params) => this.transloco.translate(key, params));
  }
}
