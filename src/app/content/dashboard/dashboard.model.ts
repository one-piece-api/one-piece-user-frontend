/**
 * What the dashboard (UF-CNT-19) receives from the content API, and the pure functions it
 * derives its display from - no Angular in here, so each one is testable on its own.
 */
import { localizedName, type VersionStatus } from '../content.model';
import { eventKind } from '../version-event';

/** The kinds of content, as the API names them. */
export type EntityType = 'DEVIL_FRUIT_TYPE';

/** Where each kind of content lives in the app, and how one of it is called. */
export const ENTITY_SECTION: Record<EntityType, { route: string; labelKey: string }> = {
  DEVIL_FRUIT_TYPE: {
    route: '/content/devil-fruit-types',
    labelKey: 'content.devilFruitTypes.one',
  },
};

/**
 * One tile: how many contents have a version the caller sees in this status. `mine` is the
 * caller's share - their drafts, the reviews they hold - `null` for a status with none.
 */
export interface StatusCount {
  status: VersionStatus;
  count: number;
  mine: number | null;
}

/** The tiles, already limited to what the caller sees and in workflow order. */
export interface Dashboard {
  statuses: StatusCount[];
}

/** How a content of any kind is called: its name per language, else the fallback. */
export interface ContentTitle {
  names: Record<string, string>;
  fallback: string | null;
}

/**
 * One of the caller's own latest actions. `title` is `null` once the caller no longer sees
 * the content, or it is gone: the action is then shown by `label`, what the content was
 * called when it happened, without a link. `entityType` and `versionNumber` are `null`
 * when the content or the version no longer exists.
 */
export interface Activity {
  action: string;
  occurredAt: string;
  entityType: EntityType | null;
  contentId: string;
  versionNumber: number | null;
  label: string | null;
  title: ContentTitle | null;
}

/** A playful line under each tile, as in the reference mockup. */
export const TILE_QUIP_KEY: Partial<Record<VersionStatus, string>> = {
  DRAFT: 'content.dashboard.quip.draft',
  IN_REVIEW: 'content.dashboard.quip.inReview',
  REJECTED: 'content.dashboard.quip.rejected',
  READY_TO_PUBLISH: 'content.dashboard.quip.readyToPublish',
  PUBLISHED: 'content.dashboard.quip.published',
  ARCHIVED: 'content.dashboard.quip.archived',
  RETIRED: 'content.dashboard.quip.retired',
};

/**
 * "2 mine" on the drafts, "1 claimed by you" on the reviews: the key of the tag, `null`
 * when the status has no "mine" or none of it is the caller's.
 */
export function mineTagKey(tile: StatusCount): string | null {
  if (!tile.mine) {
    return null;
  }
  return tile.status === 'DRAFT' ? 'content.dashboard.mineDrafts' : 'content.dashboard.mineClaimed';
}

/** The audit actions the dashboard has words for - a stable contract with the backend (D4). */
const KNOWN_ACTIONS = new Set([
  'VERSION_CREATED',
  'VERSION_EDITED',
  'VERSION_DELETED',
  'VERSION_SUBMITTED',
  'VERSION_PULLED_BACK',
  'VERSION_CLAIMED',
  'VERSION_RELEASED',
  'VERSION_APPROVED',
  'VERSION_REJECTED',
  'VERSION_RETURNED_TO_DRAFT',
  'VERSION_PUBLISHED',
  'VERSION_SUPERSEDED',
  'VERSION_ARCHIVED',
  'VERSION_RECOVERED',
  'VERSION_RETIRED',
  'VERSION_RESTORED',
]);

/** "You published": the key of what the caller did, a generic one for an unknown action. */
export function activityVerbKey(action: string): string {
  return KNOWN_ACTIONS.has(action)
    ? `content.dashboard.activity.verb.${action}`
    : 'content.dashboard.activity.verb.other';
}

/** The status an action leaves the version in, for the dot of its row - `null` for a discarded draft. */
export function activityStatus(action: string): VersionStatus | null {
  return eventKind(action)?.status ?? null;
}

/**
 * How the action's content is called: its current name in the reader's language, else in
 * any, else its fallback; once the caller no longer sees it, what it was called back then.
 */
export function activityName(activity: Activity, language: string): string | null {
  if (activity.title) {
    return localizedName(activity.title.names, language) ?? activity.title.fallback;
  }
  return activity.label;
}

/** Where the action's content opens - `null` when the caller can no longer open it. */
export function activityLink(activity: Activity): string | null {
  if (!activity.title || !activity.entityType) {
    return null;
  }
  return `${ENTITY_SECTION[activity.entityType].route}/${activity.contentId}`;
}
