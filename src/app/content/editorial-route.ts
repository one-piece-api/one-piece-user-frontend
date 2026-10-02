import type { VersionEvent, VersionStatus } from './content.model';
import { eventKind } from './version-event';

/**
 * The editorial route of a version as a map: five statuses on the main line and, hanging
 * under three of them, the branch that leaves the line there. No Angular in here - the
 * route is derived from a status and a history alone, see `editorialRoute`.
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

/** Where the version is now, where it has been, where it never went. */
export type NodeState = 'current' | 'visited' | 'idle';

/** A stretch between two statuses: travelled by this version, in either direction, or not. */
export type ConnectorState = 'followed' | 'idle';

/** One status on the map. `reachedBy` is the event that last brought the version there. */
export interface RouteNode {
  readonly status: VersionStatus;
  readonly state: NodeState;
  readonly reachedBy: VersionEvent | null;
}

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
 * The map of a version in `status` whose history is `events`, oldest first. The statuses
 * the events led through are the route followed; the current status closes it even when no
 * event says so - a version is superseded by the publication of another one.
 */
export function editorialRoute(
  status: VersionStatus,
  events: readonly VersionEvent[],
): EditorialRoute {
  const journey = journeyOf(status, events);
  const node = (of: VersionStatus): RouteNode => ({
    status: of,
    state: stateOf(of, status, journey),
    reachedBy: journey.arrivals.get(of) ?? null,
  });
  const connector = (from: VersionStatus, to: VersionStatus): ConnectorState =>
    journey.legs.has(leg(from, to)) || journey.legs.has(leg(to, from)) ? 'followed' : 'idle';

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

function stateOf(of: VersionStatus, current: VersionStatus, journey: Journey): NodeState {
  if (of === current) {
    return 'current';
  }
  return journey.path.includes(of) ? 'visited' : 'idle';
}

function leg(from: VersionStatus, to: VersionStatus): string {
  return `${from}>${to}`;
}
