import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorOf } from '../shared/http/api-error';
import type { MascotTone } from '../shared/mascot/mascot';
import type { ConfirmTone } from '../shared/ui/confirm-dialog';
import type { VersionAction, VersionStatus, VersionSummary } from './content.model';

/** What the screens know of a workflow transition they can run. */
export interface VersionTransition {
  /** The status the version is in once the transition is done. */
  readonly target: VersionStatus;
  /** The last segment of its endpoint, under `…/versions/{number}/`. */
  readonly path: string;
  /** What the mascot says once it is done, and in which tone - success unless said. */
  readonly doneKey: string;
  readonly doneTone?: MascotTone;
  /** What the mascot says instead when the version went online in place of another. */
  readonly doneReplacingKey?: string;
  /** What the mascot says instead on someone else's version: an administrator acted in the author's place. */
  readonly doneForOthersKey?: string;
  /** Posted with a reason the caller writes first, not with an empty body. */
  readonly asksReason?: boolean;
  /**
   * Confirmed first, in words under this key: `title`, `body` - `bodyReplacing` when the
   * version goes online in place of another - `note` and `confirm`; with the button in
   * `confirmTone`, `primary` unless said.
   */
  readonly confirmKey?: string;
  readonly confirmTone?: ConfirmTone;
}

/** A rejection reason says what to fix: at least a short sentence - as the backend checks. */
export const REJECTION_REASON_MIN_LENGTH = 8;
export const REJECTION_REASON_MAX_LENGTH = 2000;

/**
 * The transitions the screens run, the same for every kind of content - the route map
 * offers them, the detail posts them. An action not listed here - nor `NEW_VERSION` - does
 * not move the version, and the route map never offers it as a way out: a draft is edited
 * from its own status and discarded from its own button. Claiming and releasing leave the
 * version where it is: they are run from its current status, not towards another.
 */
export const VERSION_TRANSITIONS: Partial<Record<VersionAction, VersionTransition>> = {
  SUBMIT: { target: 'IN_REVIEW', path: 'submit', doneKey: 'content.workflow.done.submitted' },
  PULL_BACK: {
    target: 'DRAFT',
    path: 'pull-back',
    doneKey: 'content.workflow.done.pulledBack',
    doneForOthersKey: 'content.workflow.done.pulledBackForOthers',
  },
  CLAIM: { target: 'IN_REVIEW', path: 'claim', doneKey: 'content.workflow.done.claimed' },
  RELEASE: {
    target: 'IN_REVIEW',
    path: 'release',
    doneKey: 'content.workflow.done.released',
    doneTone: 'info',
  },
  APPROVE: {
    target: 'READY_TO_PUBLISH',
    path: 'approve',
    doneKey: 'content.workflow.done.approved',
  },
  REJECT: {
    target: 'REJECTED',
    path: 'reject',
    doneKey: 'content.workflow.done.rejected',
    doneTone: 'info',
    asksReason: true,
  },
  RETURN_TO_DRAFT: {
    target: 'DRAFT',
    path: 'return-to-draft',
    doneKey: 'content.workflow.done.returnedToDraft',
    doneForOthersKey: 'content.workflow.done.returnedToDraftForOthers',
    doneTone: 'info',
  },
  PUBLISH: {
    target: 'PUBLISHED',
    path: 'publish',
    doneKey: 'content.workflow.done.published',
    confirmKey: 'content.workflow.publish',
  },
  ARCHIVE: {
    target: 'ARCHIVED',
    path: 'archive',
    doneKey: 'content.workflow.done.archived',
    doneTone: 'info',
    confirmKey: 'content.workflow.archive',
    confirmTone: 'archive',
  },
  RECOVER: {
    target: 'READY_TO_PUBLISH',
    path: 'recover',
    doneKey: 'content.workflow.done.recovered',
  },
  RETIRE: {
    target: 'RETIRED',
    path: 'retire',
    doneKey: 'content.workflow.done.retired',
    doneTone: 'info',
    confirmKey: 'content.workflow.retire',
    confirmTone: 'retire',
  },
  RESTORE: {
    target: 'PUBLISHED',
    path: 'restore',
    doneKey: 'content.workflow.done.restored',
    doneReplacingKey: 'content.workflow.done.restoredReplacing',
    confirmKey: 'content.workflow.restore',
  },
};

/**
 * Opening a new version from the one on screen (UF-CNT-08). The route map offers it on
 * Draft, where the new version starts, but it is not a transition of this version: it is
 * posted to the content's versions, and leaves this one where it is. What the mascot says
 * once it is done depends on the base: an archived one stays in the history; from any other,
 * the version online - if there is one - stays online.
 */
export const NEW_VERSION = {
  action: 'OPEN_NEW_VERSION',
  target: 'DRAFT',
  doneKey: {
    fromArchived: 'content.workflow.done.reopened',
    keepingOnline: 'content.workflow.done.openedKeepingOnline',
    plain: 'content.workflow.done.opened',
  },
} as const satisfies { action: VersionAction; target: VersionStatus; doneKey: object };

/** What the mascot says once a new version is open, by the status of its base and what is online. */
export function newVersionDoneKey(baseStatus: VersionStatus, onlineVersion: number | null): string {
  if (baseStatus === 'ARCHIVED') {
    return NEW_VERSION.doneKey.fromArchived;
  }
  return onlineVersion === null ? NEW_VERSION.doneKey.plain : NEW_VERSION.doneKey.keepingOnline;
}

/**
 * The overrides confirmed first, naming whose version or claim it is: an administrator acting
 * on someone else's work (2.3). The other override - claiming one's own version - touches
 * nobody else's work, and goes at once like any claim.
 */
const CONFIRMED_OVERRIDES: readonly VersionAction[] = [
  'EDIT',
  'DELETE',
  'SUBMIT',
  'PULL_BACK',
  'RETURN_TO_DRAFT',
  'RELEASE',
];

/** Whether running `action` acts on someone else's work, and so asks for a confirmation first. */
export function confirmsOverride(
  action: VersionAction,
  overrideActions: readonly VersionAction[],
): boolean {
  return overrideActions.includes(action) && CONFIRMED_OVERRIDES.includes(action);
}

/** Whose work an override acts on: the claim's holder for a release, the author otherwise. */
export function overriddenUser(
  action: VersionAction,
  version: Pick<VersionSummary, 'author' | 'claimant'>,
): string {
  return action === 'RELEASE' && version.claimant
    ? version.claimant.username
    : version.author.username;
}

/**
 * The status the route map offers an action on: where a transition takes the version, or -
 * for a new version - Draft. `undefined` for an action the screens cannot run yet.
 */
export function routeTargetOf(action: VersionAction): VersionStatus | undefined {
  return action === NEW_VERSION.action ? NEW_VERSION.target : VERSION_TRANSITIONS[action]?.target;
}

/**
 * Why a transition did not happen, as the screen tells it: what the version still lacks,
 * which values another content holds, a romaji giving another content's public address
 * (`slug`) or none at all, which version it repeats - or that it moved in the meantime, or
 * a failure with nothing more to say. `fields` are named as the backend names
 * them (`romaji`, `translations[it].name`).
 */
export type TransitionRefusal =
  | { readonly kind: 'incomplete'; readonly fields: readonly string[] }
  | { readonly kind: 'taken'; readonly fields: readonly string[] }
  | { readonly kind: 'slugTaken'; readonly slug: string }
  | { readonly kind: 'noSlug' }
  | { readonly kind: 'identical'; readonly version: number }
  | { readonly kind: 'stale' }
  | { readonly kind: 'failed' };

/**
 * A version that is no longer there, no longer the caller's to move or no longer in a state
 * for it: someone else acted first, and the screen only has to show it as it now is.
 */
const STALE_STATUSES = [403, 404, 409];

export function transitionRefusal(error: unknown): TransitionRefusal {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'failed' };
  }
  const apiError = apiErrorOf(error);
  const fields = (apiError?.errors ?? []).map((violation) => violation.field);
  switch (apiError?.errorCode) {
    case 'CONTENT_VERSION_INCOMPLETE':
      return { kind: 'incomplete', fields };
    case 'CONTENT_VALUE_ALREADY_USED':
      return { kind: 'taken', fields };
    case 'CONTENT_SLUG_ALREADY_USED':
      return { kind: 'slugTaken', slug: refusedSlug(error) };
    case 'CONTENT_VALUE_INVALID':
      return { kind: 'noSlug' };
    case 'CONTENT_VERSION_IDENTICAL':
      return { kind: 'identical', version: identicalTo(error) };
  }
  return STALE_STATUSES.includes(error.status) ? { kind: 'stale' } : { kind: 'failed' };
}

/** The public address another content already has, carried next to the error code. */
export function refusedSlug(error: HttpErrorResponse): string {
  const body = error.error as { slug?: unknown };
  return typeof body.slug === 'string' ? body.slug : '';
}

/** The version a refused submission repeats, carried next to the error code. */
function identicalTo(error: HttpErrorResponse): number {
  const body = error.error as { identicalTo?: unknown };
  return typeof body.identicalTo === 'number' ? body.identicalTo : 0;
}
