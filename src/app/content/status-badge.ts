import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { STATUS_LABEL_KEY, type VersionStatus } from './content.model';

/** Fill and text color of each status pill - literal class names, so Tailwind keeps them. */
const PILL_CLASSES: Record<VersionStatus, string> = {
  DRAFT: 'bg-status-draft-soft text-status-draft-ink',
  IN_REVIEW: 'bg-status-review-soft text-status-review-ink',
  REJECTED: 'bg-status-rejected-soft text-status-rejected-ink',
  READY_TO_PUBLISH: 'bg-status-ready-soft text-status-ready-ink',
  PUBLISHED: 'bg-status-published-soft text-status-published-ink',
  ARCHIVED: 'bg-status-archived-soft text-status-archived-ink',
  RETIRED: 'bg-status-retired-soft text-status-retired-ink',
  SUPERSEDED: 'bg-status-superseded-soft text-status-superseded-ink',
};

const DOT_CLASSES: Record<VersionStatus, string> = {
  DRAFT: 'bg-status-draft-accent',
  IN_REVIEW: 'bg-status-review-accent',
  REJECTED: 'bg-status-rejected-accent',
  READY_TO_PUBLISH: 'bg-status-ready-accent',
  PUBLISHED: 'bg-status-published-accent',
  ARCHIVED: 'bg-status-archived-accent',
  RETIRED: 'bg-status-retired-accent',
  SUPERSEDED: 'bg-status-superseded-accent',
};

/** The same accent as a left border - the colored edge of a list row. */
export const STATUS_BORDER_CLASS: Record<VersionStatus, string> = {
  DRAFT: 'border-l-status-draft-accent',
  IN_REVIEW: 'border-l-status-review-accent',
  REJECTED: 'border-l-status-rejected-accent',
  READY_TO_PUBLISH: 'border-l-status-ready-accent',
  PUBLISHED: 'border-l-status-published-accent',
  ARCHIVED: 'border-l-status-archived-accent',
  RETIRED: 'border-l-status-retired-accent',
  SUPERSEDED: 'border-l-status-superseded-accent',
};

/** The pill naming the editorial status of a version: a dot in its accent, then its label. */
@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  imports: [TranslocoPipe],
})
export class StatusBadge {
  readonly status = input.required<VersionStatus>();

  protected readonly pillClasses = computed(() => PILL_CLASSES[this.status()]);
  protected readonly dotClasses = computed(() => DOT_CLASSES[this.status()]);
  protected readonly labelKey = computed(() => STATUS_LABEL_KEY[this.status()]);
}
