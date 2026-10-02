/**
 * The shapes the content API returns for every kind of content, and the pure functions the
 * content screens derive their display from - no Angular in here, so each one is testable
 * on its own. See `docs/user-flows/content-editorial-workflow.md` (root repo) for the rules.
 */

/** Where a version stands in the editorial workflow, in workflow order. */
export type VersionStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'REJECTED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'RETIRED'
  | 'SUPERSEDED';

/** An author, claimant or actor: the username is what is shown and filtered by. */
export interface ContentUser {
  id: string;
  username: string;
  email: string;
}

/**
 * One row of an entity list: a content, represented by one of its versions.
 * `onlineVersionNumber` is the version currently online - possibly another one, `null`
 * when nothing is. `body` is what the row shows of the version, specific to the entity.
 */
export interface ContentSummary<TBody> {
  id: string;
  versionNumber: number;
  status: VersionStatus;
  author: ContentUser;
  updatedAt: string;
  onlineVersionNumber: number | null;
  body: TBody;
}

/** What surrounds a list whatever filter is on: its size, the caller's share, their statuses. */
export interface ContentListSummary {
  total: number;
  mine: number;
  statuses: VersionStatus[];
}

/** Translation key of each status label - templates resolve it with `| transloco`. */
export const STATUS_LABEL_KEY: Record<VersionStatus, string> = {
  DRAFT: 'content.status.draft',
  IN_REVIEW: 'content.status.inReview',
  REJECTED: 'content.status.rejected',
  READY_TO_PUBLISH: 'content.status.readyToPublish',
  PUBLISHED: 'content.status.published',
  ARCHIVED: 'content.status.archived',
  RETIRED: 'content.status.retired',
  SUPERSEDED: 'content.status.superseded',
};

/** The "updated" filter: no limit, today, the last week, the last month. */
export const UPDATED_WITHIN_OPTIONS = [
  { days: null, labelKey: 'content.list.updated.always' },
  { days: 0, labelKey: 'content.list.updated.today' },
  { days: 7, labelKey: 'content.list.updated.last7' },
  { days: 30, labelKey: 'content.list.updated.last30' },
] as const;

/**
 * The "vN online" flag of a row: the online version, when it is not the one the row shows.
 * `null` when the row already shows the online version or nothing is online.
 */
export function otherOnlineVersion(row: ContentSummary<unknown>): number | null {
  const online = row.onlineVersionNumber;
  return online !== null && online !== row.versionNumber ? online : null;
}

/**
 * The name to show for a set of per-language names: the active language's, else any other
 * language's, else `null` (the caller falls back to the romaji or to "unnamed").
 */
export function localizedName(names: Record<string, string>, language: string): string | null {
  return names[language] ?? Object.values(names)[0] ?? null;
}

/** How long ago something happened, bucketed the way a list cell says it. */
export type UpdatedMoment =
  | { kind: 'today'; time: string }
  | { kind: 'yesterday'; time: string }
  | { kind: 'date'; date: string; time: string };

/**
 * Buckets an ISO instant against `now` in the viewer's own timezone: "today 08:45",
 * "yesterday 19:10", or a short date - the year only when it is not the current one.
 */
export function updatedMoment(updatedAt: string, now: Date, locale: string): UpdatedMoment {
  const updated = new Date(updatedAt);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    updated,
  );
  const daysAgo = Math.round((startOfDay(now) - startOfDay(updated)) / MILLISECONDS_PER_DAY);
  if (daysAgo === 0) {
    return { kind: 'today', time };
  }
  if (daysAgo === 1) {
    return { kind: 'yesterday', time };
  }
  const sameYear = updated.getFullYear() === now.getFullYear();
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(updated);
  return { kind: 'date', date, time };
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
