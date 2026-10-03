import type { VersionAction, VersionEvent, VersionStatus } from './content.model';
import { eventKind } from './version-event';
import { routeTargetOf } from './version-transition';

/**
 * The editorial route of a version as a map: five statuses on the main line and, hanging
 * under three of them, the branch that leaves the line there. No Angular in here - the
 * route is derived from a status, a history and what the caller may do, see `editorialRoute`.
 */

const MAIN_LINE: readonly VersionStatus[] = [
  'DRAFT',
  'IN_REVIEW',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'SUPERSEDED',
];

/** The branch under each status of the main line, by position. */
const BRANCHES: readonly (VersionStatus | null)[] = [null, 'REJECTED', 'ARCHIVED', 'RETIRED', null];

/**
 * Where the version is now, where the caller may take it next, where it has been, where it
 * never went.
 */
export type NodeState = 'current' | 'next' | 'visited' | 'idle';

/**
 * A stretch between two statuses: the one the caller may take the version along, travelled
 * by this version in either direction, or neither.
 */
export type ConnectorState = 'next' | 'followed' | 'idle';

/**
 * One status on the map. `reachedBy` is the event that last brought the version there;
 * `transition` the action taking it there from where it is, on a `next` status only.
 */
export type RouteNode = {
  readonly status: VersionStatus;
  readonly reachedBy: VersionEvent | null;
} & (
  | { readonly state: 'next'; readonly transition: VersionAction }
  | { readonly state: Exclude<NodeState, 'next'>; readonly transition: null }
);

/**
 * One column of the map: a status of the main line, its branch if it has one, and the
 * stretches leaving it - `null` where there is nothing to connect to.
 */
export interface RouteColumn {
  readonly main: RouteNode;
  readonly branch: RouteNode | null;
  readonly toPrevious: ConnectorState | null;
  readonly toNext: ConnectorState | null;
  readonly toBranch: ConnectorState | null;
}

/** The whole map. `returnToDraft` is the way back from Rejected to Draft. */
export interface EditorialRoute {
  readonly columns: readonly RouteColumn[];
  readonly returnToDraft: ConnectorState;
}

/**
 * The map of a version in `status` whose history is `events`, oldest first, for a caller
 * allowed `allowedActions` on it. The statuses the events led through are the route
 * followed; the current status closes it even when no event says so - a version is
 * superseded by the publication of another one. A status an allowed transition leads to
 * is `next`, whether or not the version has been there before.
 */
export function editorialRoute(
  status: VersionStatus,
  events: readonly VersionEvent[],
  allowedActions: readonly VersionAction[] = [],
): EditorialRoute {
  const journey = journeyOf(status, events);
  const transitions = transitionsFrom(status, allowedActions);
  const node = (of: VersionStatus): RouteNode => {
    const reachedBy = journey.arrivals.get(of) ?? null;
    const transition = transitions.get(of);
    return transition
      ? { status: of, state: 'next', reachedBy, transition }
      : { status: of, state: stateOf(of, status, journey), reachedBy, transition: null };
  };
  const connector = (from: VersionStatus, to: VersionStatus): ConnectorState => {
    if ((from === status && transitions.has(to)) || (to === status && transitions.has(from))) {
      return 'next';
    }
    return journey.legs.has(leg(from, to)) || journey.legs.has(leg(to, from)) ? 'followed' : 'idle';
  };

  const columns = MAIN_LINE.map((main, index): RouteColumn => {
    const previous = MAIN_LINE[index - 1];
    const next = MAIN_LINE[index + 1];
    const branch = BRANCHES[index];
    return {
      main: node(main),
      branch: branch ? node(branch) : null,
      toPrevious: previous ? connector(previous, main) : null,
      toNext: next ? connector(main, next) : null,
      toBranch: branch ? connector(main, branch) : null,
    };
  });
  return { columns, returnToDraft: connector('REJECTED', 'DRAFT') };
}

/** What a history amounts to: the statuses gone through, how each was reached, each hop made. */
interface Journey {
  readonly path: readonly VersionStatus[];
  readonly arrivals: ReadonlyMap<VersionStatus, VersionEvent>;
  readonly legs: ReadonlySet<string>;
}

function journeyOf(status: VersionStatus, events: readonly VersionEvent[]): Journey {
  const path: VersionStatus[] = [];
  const arrivals = new Map<VersionStatus, VersionEvent>();
  for (const event of events) {
    const reached = eventKind(event.action)?.status;
    // A claim, a release, an edit: the version stays where it is.
    if (reached && reached !== path.at(-1)) {
      path.push(reached);
      arrivals.set(reached, event);
    }
  }
  if (path.at(-1) !== status) {
    path.push(status);
  }
  const legs = new Set(path.slice(1).map((to, index) => leg(path[index], to)));
  return { path, arrivals, legs };
}

/**
 * The status each allowed transition leads to, and that transition - only the ones the
 * screens can run (`routeTargetOf`), and only the ones leaving `status`: claiming and
 * releasing keep the version where it is. A new version is offered on Draft, where it starts.
 */
function transitionsFrom(
  status: VersionStatus,
  allowedActions: readonly VersionAction[],
): ReadonlyMap<VersionStatus, VersionAction> {
  const transitions = new Map<VersionStatus, VersionAction>();
  for (const action of allowedActions) {
    const target = routeTargetOf(action);
    if (target && target !== status && !transitions.has(target)) {
      transitions.set(target, action);
    }
  }
  return transitions;
}

/** Where the version stands with respect to a status, regardless of what the caller may do. */
function stateOf(
  of: VersionStatus,
  current: VersionStatus,
  journey: Journey,
): Exclude<NodeState, 'next'> {
  if (of === current) {
    return 'current';
  }
  return journey.path.includes(of) ? 'visited' : 'idle';
}

function leg(from: VersionStatus, to: VersionStatus): string {
  return `${from}>${to}`;
}
