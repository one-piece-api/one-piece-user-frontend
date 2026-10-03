import type { VersionAction, VersionEvent, VersionStatus } from './content.model';
import { editorialRoute, type EditorialRoute, type RouteNode } from './editorial-route';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };

/** A history: one event per action, an hour apart, oldest first. */
function history(...actions: string[]): VersionEvent[] {
  return actions.map((action, hour) => ({
    action,
    actor: NAMI,
    detail: null,
    occurredAt: new Date(Date.UTC(2026, 8, 1, 8 + hour)).toISOString(),
  }));
}

const CREATED = 'VERSION_CREATED';
const SUBMITTED = 'VERSION_SUBMITTED';
const CLAIMED = 'VERSION_CLAIMED';
const APPROVED = 'VERSION_APPROVED';
const REJECTED = 'VERSION_REJECTED';
const RETURNED = 'VERSION_RETURNED_TO_DRAFT';
const PUBLISHED = 'VERSION_PUBLISHED';
const SUPERSEDED = 'VERSION_SUPERSEDED';

const TO_PUBLICATION = [CREATED, SUBMITTED, CLAIMED, APPROVED, PUBLISHED];

function nodes(route: EditorialRoute): RouteNode[] {
  return route.columns.flatMap((column) =>
    column.branch ? [column.main, column.branch] : [column.main],
  );
}

function node(route: EditorialRoute, status: VersionStatus): RouteNode {
  return nodes(route).find((candidate) => candidate.status === status)!;
}

/** The statuses in each state, e.g. `{ current: ['DRAFT'], visited: [], idle: [...] }`. */
function statesOf(route: EditorialRoute) {
  const inState = (state: RouteNode['state']) =>
    nodes(route)
      .filter((candidate) => candidate.state === state)
      .map((candidate) => candidate.status);
  return { current: inState('current'), visited: inState('visited') };
}

/** The stretches of the main line, left to right, then the three branches. */
function connectors(route: EditorialRoute) {
  return {
    main: route.columns.slice(0, -1).map((column) => column.toNext),
    branches: route.columns.filter((column) => column.branch).map((column) => column.toBranch),
    returnToDraft: route.returnToDraft,
  };
}

describe('editorialRoute', () => {
  it('lays out five statuses on the main line and three branches under the middle ones', () => {
    const route = editorialRoute('DRAFT', history(CREATED));

    expect(route.columns.map((column) => column.main.status)).toEqual([
      'DRAFT',
      'IN_REVIEW',
      'READY_TO_PUBLISH',
      'PUBLISHED',
      'SUPERSEDED',
    ]);
    expect(route.columns.map((column) => column.branch?.status ?? null)).toEqual([
      null,
      'REJECTED',
      'ARCHIVED',
      'RETIRED',
      null,
    ]);
    expect(route.columns[0].toPrevious).toBeNull();
    expect(route.columns[4].toNext).toBeNull();
  });

  it('puts a draft on its first status with nothing followed', () => {
    const route = editorialRoute('DRAFT', history(CREATED));

    expect(statesOf(route)).toEqual({ current: ['DRAFT'], visited: [] });
    expect(connectors(route)).toEqual({
      main: ['idle', 'idle', 'idle', 'idle'],
      branches: ['idle', 'idle', 'idle'],
      returnToDraft: 'idle',
    });
  });

  it('does not move for a claim: the version in review stays in review', () => {
    const route = editorialRoute('IN_REVIEW', history(CREATED, SUBMITTED, CLAIMED));

    expect(statesOf(route)).toEqual({ current: ['IN_REVIEW'], visited: ['DRAFT'] });
    expect(connectors(route).main).toEqual(['followed', 'idle', 'idle', 'idle']);
    // Reached when it was submitted, not when it was claimed.
    expect(node(route, 'IN_REVIEW').reachedBy?.action).toBe(SUBMITTED);
  });

  it('takes the branch down to Rejected', () => {
    const route = editorialRoute('REJECTED', history(CREATED, SUBMITTED, CLAIMED, REJECTED));

    expect(statesOf(route)).toEqual({ current: ['REJECTED'], visited: ['DRAFT', 'IN_REVIEW'] });
    expect(connectors(route)).toEqual({
      main: ['followed', 'idle', 'idle', 'idle'],
      branches: ['followed', 'idle', 'idle'],
      returnToDraft: 'idle',
    });
    expect(node(route, 'REJECTED').reachedBy?.action).toBe(REJECTED);
  });

  it('keeps the detour of a version rejected, returned to draft and then approved', () => {
    const events = history(
      CREATED,
      SUBMITTED,
      CLAIMED,
      REJECTED,
      RETURNED,
      SUBMITTED,
      CLAIMED,
      APPROVED,
    );
    const route = editorialRoute('READY_TO_PUBLISH', events);

    expect(statesOf(route)).toEqual({
      current: ['READY_TO_PUBLISH'],
      visited: ['DRAFT', 'IN_REVIEW', 'REJECTED'],
    });
    expect(connectors(route)).toEqual({
      main: ['followed', 'followed', 'idle', 'idle'],
      branches: ['followed', 'idle', 'idle'],
      returnToDraft: 'followed',
    });
    // Each status remembers the last time the version got there.
    expect(node(route, 'DRAFT').reachedBy).toBe(events[4]);
    expect(node(route, 'IN_REVIEW').reachedBy).toBe(events[5]);
  });

  it('follows the main line up to the online version', () => {
    const route = editorialRoute('PUBLISHED', history(...TO_PUBLICATION));

    expect(statesOf(route)).toEqual({
      current: ['PUBLISHED'],
      visited: ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'],
    });
    expect(connectors(route).main).toEqual(['followed', 'followed', 'followed', 'idle']);
  });

  it('closes the route on Superseded although no event of the version says so', () => {
    const route = editorialRoute('SUPERSEDED', history(...TO_PUBLICATION));

    expect(statesOf(route).current).toEqual(['SUPERSEDED']);
    expect(node(route, 'PUBLISHED').state).toBe('visited');
    expect(node(route, 'SUPERSEDED').reachedBy).toBeNull();
    expect(connectors(route).main).toEqual(['followed', 'followed', 'followed', 'followed']);
  });

  it('reaches Superseded by the record of the publication that replaced the version', () => {
    const route = editorialRoute('SUPERSEDED', history(...TO_PUBLICATION, SUPERSEDED));

    expect(statesOf(route).current).toEqual(['SUPERSEDED']);
    expect(node(route, 'SUPERSEDED').reachedBy?.action).toBe(SUPERSEDED);
    expect(connectors(route).main).toEqual(['followed', 'followed', 'followed', 'followed']);
  });

  it('offers a publisher to take a version ready to publish online', () => {
    const route = editorialRoute('READY_TO_PUBLISH', history(CREATED), ['PUBLISH', 'ARCHIVE']);

    expect(node(route, 'PUBLISHED')).toMatchObject({ state: 'next', transition: 'PUBLISH' });
    expect(connectors(route).main[2]).toBe('next');
  });

  it('takes the branch to Archived, and back when the version is recovered', () => {
    const archived = history(CREATED, SUBMITTED, CLAIMED, APPROVED, 'VERSION_ARCHIVED');

    const setAside = editorialRoute('ARCHIVED', archived);
    expect(statesOf(setAside).current).toEqual(['ARCHIVED']);
    expect(connectors(setAside).branches).toEqual(['idle', 'followed', 'idle']);

    const recovered = [...archived, ...history('VERSION_RECOVERED')];
    const back = editorialRoute('READY_TO_PUBLISH', recovered);
    expect(statesOf(back).current).toEqual(['READY_TO_PUBLISH']);
    expect(node(back, 'ARCHIVED').state).toBe('visited');
    expect(node(back, 'READY_TO_PUBLISH').reachedBy?.action).toBe('VERSION_RECOVERED');
  });

  it('takes the branch to Retired, and comes back online when restored', () => {
    const retired = history(...TO_PUBLICATION, 'VERSION_RETIRED');

    const offline = editorialRoute('RETIRED', retired);
    expect(statesOf(offline).current).toEqual(['RETIRED']);
    expect(connectors(offline).branches).toEqual(['idle', 'idle', 'followed']);

    const restored = editorialRoute('PUBLISHED', [...retired, ...history('VERSION_RESTORED')]);
    expect(statesOf(restored).current).toEqual(['PUBLISHED']);
    expect(node(restored, 'RETIRED').state).toBe('visited');
    expect(node(restored, 'PUBLISHED').reachedBy?.action).toBe('VERSION_RESTORED');
  });

  it('shows only the current status for a version with no recorded history', () => {
    const route = editorialRoute('PUBLISHED', []);

    expect(statesOf(route)).toEqual({ current: ['PUBLISHED'], visited: [] });
    expect(connectors(route).main).toEqual(['idle', 'idle', 'idle', 'idle']);
  });

  it('marks the status an allowed transition leads to as next, and the stretch to it', () => {
    const route = editorialRoute('DRAFT', history(CREATED), ['EDIT', 'DELETE', 'SUBMIT']);

    expect(node(route, 'IN_REVIEW')).toMatchObject({ state: 'next', transition: 'SUBMIT' });
    expect(node(route, 'DRAFT')).toMatchObject({ state: 'current', transition: null });
    expect(connectors(route).main).toEqual(['next', 'idle', 'idle', 'idle']);
  });

  it('makes a status already gone through next when the transition leads back to it', () => {
    const route = editorialRoute('IN_REVIEW', history(CREATED, SUBMITTED), ['PULL_BACK']);

    expect(node(route, 'DRAFT')).toMatchObject({ state: 'next', transition: 'PULL_BACK' });
    expect(connectors(route).main).toEqual(['next', 'idle', 'idle', 'idle']);
  });

  it('ignores an action the screens cannot run, one that leads nowhere and one that stays put', () => {
    const allowed: VersionAction[] = ['ARCHIVE', 'EDIT', 'CLAIM', 'RELEASE'];
    const route = editorialRoute('IN_REVIEW', history(CREATED, SUBMITTED), allowed);

    expect(nodes(route).filter((candidate) => candidate.state === 'next')).toEqual([]);
    expect(node(route, 'IN_REVIEW')).toMatchObject({ state: 'current', transition: null });
    expect(connectors(route).main).toEqual(['followed', 'idle', 'idle', 'idle']);
  });

  it('ignores an action it does not know', () => {
    const route = editorialRoute('IN_REVIEW', history(CREATED, 'VERSION_TELEPORTED', SUBMITTED));

    expect(statesOf(route)).toEqual({ current: ['IN_REVIEW'], visited: ['DRAFT'] });
  });
});
