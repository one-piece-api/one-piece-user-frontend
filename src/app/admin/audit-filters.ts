import { Component, computed, input, output } from '@angular/core';
import { DatePicker, formatIsoDateDisplay } from '../shared/ui/date-picker';
import { AuditActorFilter } from './audit-actor-filter';
import { AuditKindFilter } from './audit-kind-filter';
import { AUDIT_ACTION_LABEL } from './audit.model';

interface FilterChip {
  label: string;
  remove: () => void;
}

/**
 * The Ship's Log filter bar (action type, author, date range) plus the "active filters"
 * chip row beneath it. Every filter is optional and cumulative - the parent page owns the
 * actual filter state and just reflects it back down here, so this component stays a pure
 * view over whatever's currently selected.
 */
@Component({
  selector: 'app-audit-filters',
  templateUrl: './audit-filters.html',
  imports: [AuditActorFilter, AuditKindFilter, DatePicker],
})
export class AuditFilters {
  readonly selectedActions = input.required<ReadonlySet<string>>();
  readonly actorEmail = input.required<string>();
  readonly actorOptions = input.required<string[]>();
  readonly dateFrom = input.required<string | null>();
  readonly dateTo = input.required<string | null>();

  readonly actionToggled = output<string>();
  readonly actorEmailChange = output<string>();
  readonly dateFromChange = output<string | null>();
  readonly dateToChange = output<string | null>();
  readonly cleared = output<void>();

  protected readonly chips = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    for (const action of this.selectedActions()) {
      chips.push({
        label: `Type: ${AUDIT_ACTION_LABEL[action] ?? action}`,
        remove: () => this.actionToggled.emit(action),
      });
    }
    const actor = this.actorEmail();
    if (actor) {
      chips.push({ label: `Author: ${actor}`, remove: () => this.actorEmailChange.emit('') });
    }
    const from = this.dateFrom();
    const to = this.dateTo();
    if (from || to) {
      const fromLabel = from ? formatIsoDateDisplay(from) : '…';
      const toLabel = to ? formatIsoDateDisplay(to) : '…';
      chips.push({
        label: `${fromLabel} – ${toLabel}`,
        remove: () => {
          this.dateFromChange.emit(null);
          this.dateToChange.emit(null);
        },
      });
    }
    return chips;
  });
}
