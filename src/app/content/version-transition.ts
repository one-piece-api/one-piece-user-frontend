import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorOf } from '../shared/http/api-error';
import type { MascotTone } from '../shared/mascot/mascot';
import type { VersionAction, VersionStatus } from './content.model';

/** What the screens know of a workflow transition they can run. */
export interface VersionTransition {
  /** The status the version is in once the transition is done. */
  readonly target: VersionStatus;
  /** The last segment of its endpoint, under `…/versions/{number}/`. */
  readonly path: string;
  /** What the mascot says once it is done, and in which tone - success unless said. */
  readonly doneKey: string;
  readonly doneTone?: MascotTone;
}

/**
 * The transitions the screens run, the same for every kind of content - the route map
 * offers them, the detail posts them. An action not listed here is never offered, even
 * when the backend allows it: its endpoint does not exist yet. Claiming and releasing
 * leave the version where it is: they are run from its current status, not towards another.
 */
export const VERSION_TRANSITIONS: Partial<Record<VersionAction, VersionTransition>> = {
  SUBMIT: { target: 'IN_REVIEW', path: 'submit', doneKey: 'content.workflow.done.submitted' },
  PULL_BACK: { target: 'DRAFT', path: 'pull-back', doneKey: 'content.workflow.done.pulledBack' },
  CLAIM: { target: 'IN_REVIEW', path: 'claim', doneKey: 'content.workflow.done.claimed' },
  RELEASE: {
    target: 'IN_REVIEW',
    path: 'release',
    doneKey: 'content.workflow.done.released',
    doneTone: 'info',
  },
};

/**
 * Why a transition did not happen, as the screen tells it: what the version still lacks,
 * which values another content holds, which version it repeats - or that it moved in the
 * meantime, or a failure with nothing more to say. `fields` are named as the backend names
 * them (`romaji`, `translations[it].name`).
 */
export type TransitionRefusal =
  | { readonly kind: 'incomplete'; readonly fields: readonly string[] }
  | { readonly kind: 'taken'; readonly fields: readonly string[] }
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
    case 'CONTENT_VERSION_IDENTICAL':
      return { kind: 'identical', version: identicalTo(error) };
  }
  return STALE_STATUSES.includes(error.status) ? { kind: 'stale' } : { kind: 'failed' };
}

/** The version a refused submission repeats, carried next to the error code. */
function identicalTo(error: HttpErrorResponse): number {
  const body = error.error as { identicalTo?: unknown };
  return typeof body.identicalTo === 'number' ? body.identicalTo : 0;
}
