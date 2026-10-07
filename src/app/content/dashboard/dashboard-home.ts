import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CurrentUserService } from '../../identity/current-user';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import { PageHeader } from '../../shared/ui/page-header';
import { STATUS_LABEL_KEY, type VersionStatus } from '../content.model';
import { entityLabelKey, entityOf } from '../entity/entities';
import { momentLabel } from '../moment-label';
import { STATUS_GLYPH } from '../status-badge';
import {
  TILE_QUIP_KEY,
  activityLink,
  activityName,
  activityStatus,
  activityVerbKey,
  mineTagKey,
  statusPageRoute,
  type Activity,
  type Dashboard,
} from './dashboard.model';

const ENDPOINT = '/api/content/dashboard';

/**
 * How a tile is painted per status: its soft fill and accent border, the hard shadow in
 * the accent, the ink of its texts and the large faded glyph. Literal class names, so
 * Tailwind keeps them.
 */
const TILE_CLASSES: Record<VersionStatus, { tile: string; ink: string; glyph: string }> = {
  DRAFT: {
    tile: 'border-status-draft-accent bg-status-draft-soft shadow-[0_5px_0_var(--color-status-draft-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-draft-ink',
    glyph: 'text-status-draft-accent shadow-[0_3px_0_var(--color-status-draft-accent)]',
  },
  IN_REVIEW: {
    tile: 'border-status-review-accent bg-status-review-soft shadow-[0_5px_0_var(--color-status-review-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-review-ink',
    glyph: 'text-status-review-accent shadow-[0_3px_0_var(--color-status-review-accent)]',
  },
  REJECTED: {
    tile: 'border-status-rejected-accent bg-status-rejected-soft shadow-[0_5px_0_var(--color-status-rejected-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-rejected-ink',
    glyph: 'text-status-rejected-accent shadow-[0_3px_0_var(--color-status-rejected-accent)]',
  },
  READY_TO_PUBLISH: {
    tile: 'border-status-ready-accent bg-status-ready-soft shadow-[0_5px_0_var(--color-status-ready-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-ready-ink',
    glyph: 'text-status-ready-accent shadow-[0_3px_0_var(--color-status-ready-accent)]',
  },
  PUBLISHED: {
    tile: 'border-status-published-accent bg-status-published-soft shadow-[0_5px_0_var(--color-status-published-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-published-ink',
    glyph: 'text-status-published-accent shadow-[0_3px_0_var(--color-status-published-accent)]',
  },
  ARCHIVED: {
    tile: 'border-status-archived-accent bg-status-archived-soft shadow-[0_5px_0_var(--color-status-archived-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-archived-ink',
    glyph: 'text-status-archived-accent shadow-[0_3px_0_var(--color-status-archived-accent)]',
  },
  RETIRED: {
    tile: 'border-status-retired-accent bg-status-retired-soft shadow-[0_5px_0_var(--color-status-retired-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-retired-ink',
    glyph: 'text-status-retired-accent shadow-[0_3px_0_var(--color-status-retired-accent)]',
  },
  SUPERSEDED: {
    tile: 'border-status-superseded-accent bg-status-superseded-soft shadow-[0_5px_0_var(--color-status-superseded-accent),0_10px_22px_rgba(18,35,90,.16)]',
    ink: 'text-status-superseded-ink',
    glyph: 'text-status-superseded-accent shadow-[0_3px_0_var(--color-status-superseded-accent)]',
  },
};

/** The dot of an activity row, in the accent of the status the action left the version in. */
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
/** A discarded draft, or an action the dashboard does not know. */
const OTHER_DOT_CLASS = 'bg-flag-600';

/** One activity row, ready to render. */
interface ActivityRow {
  readonly key: string;
  readonly when: string;
  readonly verbKey: string;
  readonly name: string;
  readonly link: string | null;
  readonly meta: string;
  readonly dotClass: string;
}

/**
 * The dashboard home (UF-CNT-19): a greeting with the caller's roles, one tile per status
 * they see - how many contents are there, and how many are theirs - and their own latest
 * actions. Every number comes from the backend, already limited to what the caller sees;
 * each tile opens its status page.
 */
@Component({
  selector: 'app-dashboard-home',
  templateUrl: './dashboard-home.html',
  imports: [LoadingPlaceholder, PageHeader, RouterLink, TranslocoPipe],
})
export class DashboardHome {
  private readonly transloco = inject(TranslocoService);
  protected readonly currentUser = inject(CurrentUserService);

  protected readonly dashboard = httpResource<Dashboard>(() => ENDPOINT);
  private readonly activity = httpResource<Activity[]>(() => `${ENDPOINT}/activity`);

  /** "Dashboard · ADMIN · EDITOR". */
  protected readonly eyebrow = computed(() => {
    this.transloco.activeLang();
    const roles = this.currentUser.me.value()?.roles ?? [];
    return [this.transloco.translate('content.dashboard.eyebrow'), ...roles].join(' · ');
  });

  protected readonly tiles = computed(() =>
    (this.dashboard.value()?.statuses ?? []).map((tile) => ({
      status: tile.status,
      labelKey: STATUS_LABEL_KEY[tile.status],
      quipKey: TILE_QUIP_KEY[tile.status] ?? null,
      glyph: STATUS_GLYPH[tile.status],
      count: tile.count,
      mine: tile.mine,
      mineTagKey: mineTagKey(tile),
      classes: TILE_CLASSES[tile.status],
      route: statusPageRoute(tile.status),
    })),
  );

  protected readonly activityState = computed<'loading' | 'error' | 'ready'>(() => {
    if (this.activity.error()) {
      return 'error';
    }
    return this.activity.hasValue() ? 'ready' : 'loading';
  });

  protected readonly activityRows = computed<ActivityRow[]>(() => {
    const language = this.transloco.activeLang();
    const activities = this.activity.hasValue() ? this.activity.value() : [];
    return activities.map((activity, index) => this.toRow(activity, index, language));
  });

  private toRow(activity: Activity, index: number, language: string): ActivityRow {
    const status = activityStatus(activity.action);
    const meta = [
      activity.versionNumber === null ? null : `v${activity.versionNumber}`,
      activity.entityType
        ? this.transloco.translate(entityLabelKey(entityOf(activity.entityType)))
        : null,
    ].filter((part) => part !== null);
    return {
      key: `${index}:${activity.occurredAt}`,
      when: momentLabel(this.transloco, activity.occurredAt),
      verbKey: activityVerbKey(activity.action),
      name: activityName(activity, language) ?? this.transloco.translate('content.list.unnamed'),
      link: activityLink(activity),
      meta: meta.join(' · '),
      dotClass: status ? DOT_CLASSES[status] : OTHER_DOT_CLASS,
    };
  }
}
