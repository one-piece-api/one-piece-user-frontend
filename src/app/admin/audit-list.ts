import { Component, input } from '@angular/core';
import { Badge } from '../shared/ui/badge';
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ACTION_TONE,
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
  imports: [Badge],
})
export class AuditList {
  readonly events = input.required<AuditEvent[]>();
  readonly emptyMessage = input('No log entries yet.');

  protected readonly actionLabel = AUDIT_ACTION_LABEL;
  protected readonly actionTone = AUDIT_ACTION_TONE;
  protected readonly formatOccurredAt = formatOccurredAt;
}
