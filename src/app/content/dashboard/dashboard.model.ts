/**
 * What the dashboard (UF-CNT-19) receives from the content API, and the pure functions it
 * derives its display from - no Angular in here, so each one is testable on its own.
 */
import type { PageResponse } from '../../shared/http/page-response';
import {
  localizedName,
  type ContentUser,
  type VersionAction,
  type VersionStatus,
} from '../content.model';
import { eventKind } from '../version-event';

/** The kinds of content, as the API names them. */
export type EntityType = 'DEVIL_FRUIT_TYPE';

/** Where each kind of content lives in the app and in the API, and how one of it is called. */
export const ENTITY_SECTION: Record<EntityType, { route: string; api: string; labelKey: string }> =
  {
    DEVIL_FRUIT_TYPE: {
      route: '/content/devil-fruit-types',
      api: '/api/content/devil-fruit-types',
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

/**
 * A status page of the dashboard: its address, and who sees it - any of these
 * permissions, as the backend's visibility table says (flows document 4.3). Superseded has
 * no page, as it has no tile.
 */
export interface StatusPageDefinition {
  readonly status: VersionStatus;
  readonly slug: string;
  readonly anyPermission: readonly string[];
}

export const STATUS_PAGES: readonly StatusPageDefinition[] = [
  { status: 'DRAFT', slug: 'draft', anyPermission: ['content:write'] },
  { status: 'IN_REVIEW', slug: 'in-review', anyPermission: ['content:write', 'content:review'] },
  { status: 'REJECTED', slug: 'rejected', anyPermission: ['content:write'] },
  { status: 'READY_TO_PUBLISH', slug: 'ready', anyPermission: ['content:read'] },
  { status: 'PUBLISHED', slug: 'published', anyPermission: ['content:read'] },
  { status: 'ARCHIVED', slug: 'archived', anyPermission: ['content:read'] },
  { status: 'RETIRED', slug: 'retired', anyPermission: ['content:read'] },
];

export const DASHBOARD_ROUTE = '/dashboard';

/** The page of a slug, `null` for one that names no status page. */
export function statusPageOf(slug: string | null | undefined): StatusPageDefinition | null {
  return STATUS_PAGES.find((page) => page.slug === slug) ?? null;
}

/** "/dashboard/in-review": where a status page lives; the overview for a status with none. */
export function statusPageRoute(status: VersionStatus): string {
  const page = STATUS_PAGES.find((candidate) => candidate.status === status);
  return page ? `${DASHBOARD_ROUTE}/${page.slug}` : DASHBOARD_ROUTE;
}

/** One row of a status page: a content of any kind, by its most recent version there. */
export interface StatusRow {
  entityType: EntityType;
  contentId: string;
  versionNumber: number;
  status: VersionStatus;
  title: ContentTitle | null;
  author: ContentUser;
  claimant: ContentUser | null;
  updatedAt: string;
  /** The version of the content online now - possibly another one - `null` when none is. */
  onlineVersionNumber: number | null;
  allowedActions: VersionAction[];
  overrideActions: VersionAction[];
}

/**
 * A page of a status, with the two counters of its scope switch - the whole status,
 * whatever page and filter is on. `mine` is `null` for a status with no "mine".
 */
export interface StatusPage {
  rows: PageResponse<StatusRow>;
  all: number;
  mine: number | null;
}

/** Drafts can be narrowed to the caller's own, reviews to the ones they hold. */
export function hasMineScope(status: VersionStatus): boolean {
  return status === 'DRAFT' || status === 'IN_REVIEW';
}

/** How each action looks on a row: its glyph and its color, as in the mockup. */
export type ActionTone = 'gold' | 'green' | 'red' | 'blue' | 'navy';

export const ACTION_LOOK: Record<VersionAction, { glyph: string; tone: ActionTone }> = {
  CLAIM: { glyph: '✋', tone: 'navy' },
  EDIT: { glyph: '✎', tone: 'blue' },
  RETURN_TO_DRAFT: { glyph: '✎', tone: 'gold' },
  SUBMIT: { glyph: '➤', tone: 'gold' },
  PULL_BACK: { glyph: '↶', tone: 'blue' },
  APPROVE: { glyph: '✓', tone: 'green' },
  REJECT: { glyph: '✕', tone: 'red' },
  PUBLISH: { glyph: '⚓', tone: 'gold' },
  ARCHIVE: { glyph: '▣', tone: 'blue' },
  RECOVER: { glyph: '↺', tone: 'gold' },
  RETIRE: { glyph: '⊘', tone: 'red' },
  RESTORE: { glyph: '↺', tone: 'gold' },
  OPEN_NEW_VERSION: { glyph: '✚', tone: 'blue' },
  DELETE: { glyph: '⌫', tone: 'red' },
  RELEASE: { glyph: '↩', tone: 'blue' },
};

/** The order a row offers its actions in - the mockup's: taking first, letting go last. */
const ROW_ACTION_ORDER: readonly VersionAction[] = [
  'CLAIM',
  'EDIT',
  'RETURN_TO_DRAFT',
  'SUBMIT',
  'PULL_BACK',
  'APPROVE',
  'REJECT',
  'PUBLISH',
  'ARCHIVE',
  'RECOVER',
  'RETIRE',
  'RESTORE',
  'OPEN_NEW_VERSION',
  'DELETE',
  'RELEASE',
];

/** At most this many icons on a row; the rest are on the detail screen. */
export const MAX_ROW_ACTIONS = 4;

/** The actions a row offers - what the backend allows, in the row's order, at most four. */
export function rowActions(row: Pick<StatusRow, 'allowedActions'>): VersionAction[] {
  return ROW_ACTION_ORDER.filter((action) => row.allowedActions.includes(action)).slice(
    0,
    MAX_ROW_ACTIONS,
  );
}

/** Why a row offers nothing - the key of its note - `null` when it offers something. */
export function rowNoteKey(
  row: Pick<StatusRow, 'allowedActions' | 'status' | 'author' | 'claimant'>,
  username: string,
): string | null {
  if (row.allowedActions.length > 0) {
    return null;
  }
  const mine = row.author.username === username;
  if (row.status === 'IN_REVIEW' && mine) {
    return 'content.dashboard.note.awaitingReviewer';
  }
  if (row.status === 'IN_REVIEW' && row.claimant && row.claimant.username !== username) {
    return 'content.dashboard.note.busy';
  }
  if (row.status === 'DRAFT' && !mine) {
    return 'content.dashboard.note.draftOf';
  }
  return 'content.dashboard.note.readOnly';
}

/**
 * "From here you can": what each action of a status does, offered to whoever holds one of
 * its permissions - a description of the page, never what decides what is allowed.
 */
export interface LegendEntry {
  readonly action: VersionAction;
  readonly anyPermission: readonly string[];
}

export const STATUS_LEGEND: Partial<Record<VersionStatus, readonly LegendEntry[]>> = {
  DRAFT: [
    { action: 'EDIT', anyPermission: ['content:write'] },
    { action: 'SUBMIT', anyPermission: ['content:write'] },
    { action: 'DELETE', anyPermission: ['content:write'] },
  ],
  IN_REVIEW: [
    { action: 'CLAIM', anyPermission: ['content:review'] },
    { action: 'APPROVE', anyPermission: ['content:review'] },
    { action: 'REJECT', anyPermission: ['content:review'] },
    { action: 'RELEASE', anyPermission: ['content:review'] },
    { action: 'PULL_BACK', anyPermission: ['content:write'] },
  ],
  REJECTED: [{ action: 'RETURN_TO_DRAFT', anyPermission: ['content:write'] }],
  READY_TO_PUBLISH: [
    { action: 'PUBLISH', anyPermission: ['content:publish'] },
    { action: 'ARCHIVE', anyPermission: ['content:publish'] },
  ],
  PUBLISHED: [
    { action: 'RETIRE', anyPermission: ['content:retire'] },
    { action: 'OPEN_NEW_VERSION', anyPermission: ['content:write'] },
  ],
  ARCHIVED: [
    { action: 'RECOVER', anyPermission: ['content:publish'] },
    { action: 'OPEN_NEW_VERSION', anyPermission: ['content:write'] },
  ],
  RETIRED: [
    { action: 'RESTORE', anyPermission: ['content:publish'] },
    { action: 'OPEN_NEW_VERSION', anyPermission: ['content:write'] },
  ],
};

/** The legend of a status for a caller: the entries one of whose permissions they hold. */
export function legendFor(
  status: VersionStatus,
  hasPermission: (permission: string) => boolean,
): LegendEntry[] {
  return (STATUS_LEGEND[status] ?? []).filter((entry) => entry.anyPermission.some(hasPermission));
}
