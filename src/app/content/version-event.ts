import type { VersionStatus } from './content.model';

/** What the screens need to know of an audit action: how to show it, and where it leaves the version. */
export interface EventKind {
  readonly labelKey: string;
  readonly glyph: string;
  /** The status the version is in once the action is done - unchanged for a claim. */
  readonly status: VersionStatus;
}

/**
 * The audit actions about a version, by their name in the audit log - a stable contract
 * with the backend (implementation plan, D4). An action missing here is still listed in
 * the timeline, by its raw name, and does not move the route.
 */
const EVENT_KINDS: Record<string, EventKind> = {
  VERSION_CREATED: { labelKey: 'content.event.created', glyph: '✎', status: 'DRAFT' },
  VERSION_EDITED: { labelKey: 'content.event.edited', glyph: '✎', status: 'DRAFT' },
  VERSION_SUBMITTED: { labelKey: 'content.event.submitted', glyph: '↗', status: 'IN_REVIEW' },
  VERSION_PULLED_BACK: { labelKey: 'content.event.pulledBack', glyph: '↩', status: 'DRAFT' },
  VERSION_CLAIMED: { labelKey: 'content.event.claimed', glyph: '✋', status: 'IN_REVIEW' },
  VERSION_RELEASED: { labelKey: 'content.event.released', glyph: '↩', status: 'IN_REVIEW' },
  VERSION_APPROVED: {
    labelKey: 'content.event.approved',
    glyph: '✓',
    status: 'READY_TO_PUBLISH',
  },
  VERSION_REJECTED: { labelKey: 'content.event.rejected', glyph: '✕', status: 'REJECTED' },
  VERSION_RETURNED_TO_DRAFT: {
    labelKey: 'content.event.returnedToDraft',
    glyph: '↩',
    status: 'DRAFT',
  },
  VERSION_PUBLISHED: { labelKey: 'content.event.published', glyph: '⚓', status: 'PUBLISHED' },
  VERSION_ARCHIVED: { labelKey: 'content.event.archived', glyph: '▣', status: 'ARCHIVED' },
  VERSION_RECOVERED: {
    labelKey: 'content.event.recovered',
    glyph: '↺',
    status: 'READY_TO_PUBLISH',
  },
  VERSION_RETIRED: { labelKey: 'content.event.retired', glyph: '⊘', status: 'RETIRED' },
  VERSION_RESTORED: { labelKey: 'content.event.restored', glyph: '↺', status: 'PUBLISHED' },
};

/** The action that opens a version, and the one carrying a rejection reason as its detail. */
export const CREATED_ACTION = 'VERSION_CREATED';
export const REJECTED_ACTION = 'VERSION_REJECTED';

/** What is known of an audit action, `null` for one this screen has never heard of. */
export function eventKind(action: string): EventKind | null {
  return EVENT_KINDS[action] ?? null;
}
