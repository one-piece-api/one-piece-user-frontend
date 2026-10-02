import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CurrentUserService } from '../identity/current-user';
import {
  STATUS_LABEL_KEY,
  STATUS_MEANING_KEY,
  type VersionEvent,
  type VersionStatus,
  type VersionSummary,
} from './content.model';
import {
  editorialRoute,
  type ConnectorState,
  type RouteColumn,
  type RouteNode,
} from './editorial-route';
import { momentLabel } from './moment-label';
import { STATUS_GLYPH } from './status-badge';

/**
 * How each status is painted on the map - literal class names, so Tailwind keeps them:
 * `current` fills the node the version is on, `soft` is the pale disc of a branch gone
 * through and of the legend, `ink` the text beside a current node.
 */
const STATUS_CLASSES: Record<VersionStatus, { current: string; soft: string; ink: string }> = {
  DRAFT: {
    current: 'border-status-draft-accent bg-status-draft-accent ring-status-draft-soft',
    soft: 'border-status-draft-accent bg-status-draft-soft text-status-draft-ink ring-status-draft-accent',
    ink: 'text-status-draft-ink',
  },
  IN_REVIEW: {
    current: 'border-status-review-accent bg-status-review-accent ring-status-review-soft',
    soft: 'border-status-review-accent bg-status-review-soft text-status-review-ink ring-status-review-accent',
    ink: 'text-status-review-ink',
  },
  REJECTED: {
    current: 'border-status-rejected-accent bg-status-rejected-accent ring-status-rejected-soft',
    soft: 'border-status-rejected-accent bg-status-rejected-soft text-status-rejected-ink ring-status-rejected-accent',
    ink: 'text-status-rejected-ink',
  },
  READY_TO_PUBLISH: {
    current: 'border-status-ready-accent bg-status-ready-accent ring-status-ready-soft',
    soft: 'border-status-ready-accent bg-status-ready-soft text-status-ready-ink ring-status-ready-accent',
    ink: 'text-status-ready-ink',
  },
  PUBLISHED: {
    current: 'border-status-published-accent bg-status-published-accent ring-status-published-soft',
    soft: 'border-status-published-accent bg-status-published-soft text-status-published-ink ring-status-published-accent',
    ink: 'text-status-published-ink',
  },
  ARCHIVED: {
    current: 'border-status-archived-accent bg-status-archived-accent ring-status-archived-soft',
    soft: 'border-status-archived-accent bg-status-archived-soft text-status-archived-ink ring-status-archived-accent',
    ink: 'text-status-archived-ink',
  },
  RETIRED: {
    current: 'border-status-retired-accent bg-status-retired-accent ring-status-retired-soft',
    soft: 'border-status-retired-accent bg-status-retired-soft text-status-retired-ink ring-status-retired-accent',
    ink: 'text-status-retired-ink',
  },
  SUPERSEDED: {
    current:
      'border-status-superseded-accent bg-status-superseded-accent ring-status-superseded-soft',
    soft: 'border-status-superseded-accent bg-status-superseded-soft text-status-superseded-ink ring-status-superseded-accent',
    ink: 'text-status-superseded-ink',
  },
};

const CURRENT_NODE_CLASSES = 'text-white ring-5';
/** A status of the main line the version has been through: a green check. */
const VISITED_MAIN_CLASSES = 'border-success-600 bg-success-600 text-white';
const VISITED_GLYPH = '✓';
const IDLE_NODE_CLASSES = 'border-parchment-50 bg-white text-ocean-500/40';

const VISITED_LABEL_CLASSES = 'text-ocean-950';
const IDLE_LABEL_CLASSES = 'text-ocean-500/60';
const VISITED_NOTE_CLASSES = 'text-ocean-500/70';

/** The main line: green where the version went, a faint rule elsewhere. */
const MAIN_LINE_CLASSES: Record<ConnectorState, string> = {
  followed: 'border-solid border-success-600',
  idle: 'border-solid border-parchment-50',
};

/** A way off the main line: dashed and grey until taken, then in the color of where it leads. */
const IDLE_BRANCH_LINE = { line: 'border-dashed border-ocean-500/25', label: 'text-ocean-500/50' };
const FOLLOWED_BRANCH_LINE: Partial<Record<VersionStatus, { line: string; label: string }>> = {
  REJECTED: {
    line: 'border-solid border-status-rejected-accent',
    label: 'text-status-rejected-accent',
  },
  ARCHIVED: {
    line: 'border-solid border-status-archived-accent',
    label: 'text-status-archived-accent',
  },
  RETIRED: {
    line: 'border-solid border-status-retired-accent',
    label: 'text-status-retired-accent',
  },
};

/** What the stretch between a status of the main line and its branch is called. */
const BRANCH_LINK_KEY: Partial<Record<VersionStatus, string>> = {
  REJECTED: 'content.workflow.link.reject',
  ARCHIVED: 'content.workflow.link.archive',
  RETIRED: 'content.workflow.link.retire',
};
const RETURN_LINK_KEY = 'content.workflow.link.returnToDraft';

/** The statuses the legend explains, in workflow order. */
const LEGEND_STATUSES = Object.keys(STATUS_LABEL_KEY) as VersionStatus[];

/** One status of the map, ready to render. */
interface NodeView {
  readonly status: VersionStatus;
  readonly state: RouteNode['state'];
  readonly current: boolean;
  readonly labelKey: string;
  readonly title: string;
  readonly glyph: string;
  readonly circleClasses: string;
  readonly labelClasses: string;
  readonly note: string;
  readonly noteClasses: string;
}

/** The stretch under a status of the main line: down to its branch, or - under Draft - back from Rejected. */
interface DropView {
  readonly lineClasses: string;
  readonly labelClasses: string;
  readonly labelKey: string;
  readonly arrow: boolean;
}

/** One column of the map, ready to render. */
interface ColumnView {
  readonly main: NodeView;
  readonly branch: NodeView | null;
  readonly previousLine: string | null;
  readonly nextLine: string | null;
  readonly drop: DropView | null;
  /** The way back from Rejected turns the corner under Draft and runs to the next column. */
  readonly returnCorner: boolean;
  readonly returnTail: boolean;
}

/**
 * "Rotta editoriale": where a version stands in the editorial workflow, drawn as a map.
 * The ship marks the current status, a green check the ones already gone through - read
 * from the version's own history - and dashed lines the ways it did not take. Read-only:
 * the nodes say where the version is, they do not move it.
 */
@Component({
  selector: 'app-route-map',
  templateUrl: './route-map.html',
  imports: [NgTemplateOutlet, TranslocoPipe],
})
export class RouteMap {
  private readonly transloco = inject(TranslocoService);
  private readonly currentUser = inject(CurrentUserService);

  readonly version = input.required<VersionSummary>();
  /** The history of the version, oldest first. */
  readonly events = input.required<readonly VersionEvent[]>();

  protected readonly legendOpen = signal(false);

  private readonly route = computed(() => editorialRoute(this.version().status, this.events()));

  protected readonly columns = computed<ColumnView[]>(() => {
    this.transloco.activeLang();
    return this.route().columns.map((column, index) => this.toColumnView(column, index));
  });

  /** The way back from Rejected to Draft, drawn across the first two columns. */
  protected readonly returnLineClasses = computed(
    () => this.branchLine('REJECTED', this.route().returnToDraft).line,
  );

  protected readonly legend = LEGEND_STATUSES.map((status) => ({
    status,
    labelKey: STATUS_LABEL_KEY[status],
    meaningKey: STATUS_MEANING_KEY[status],
    glyph: STATUS_GLYPH[status],
    discClasses: STATUS_CLASSES[status].soft,
    labelClasses: STATUS_CLASSES[status].ink,
  }));

  protected toggleLegend(): void {
    this.legendOpen.update((open) => !open);
  }

  private toColumnView(column: RouteColumn, index: number): ColumnView {
    return {
      main: this.toNodeView(column.main, true),
      branch: column.branch ? this.toNodeView(column.branch, false) : null,
      previousLine: column.toPrevious ? MAIN_LINE_CLASSES[column.toPrevious] : null,
      nextLine: column.toNext ? MAIN_LINE_CLASSES[column.toNext] : null,
      drop: this.dropOf(column, index),
      returnCorner: index === 0,
      returnTail: index === 1,
    };
  }

  private dropOf(column: RouteColumn, index: number): DropView | null {
    if (column.branch && column.toBranch) {
      const { line, label } = this.branchLine(column.branch.status, column.toBranch);
      const labelKey = BRANCH_LINK_KEY[column.branch.status] ?? '';
      return { lineClasses: line, labelClasses: label, labelKey, arrow: false };
    }
    if (index === 0) {
      const { line, label } = this.branchLine('REJECTED', this.route().returnToDraft);
      return { lineClasses: line, labelClasses: label, labelKey: RETURN_LINK_KEY, arrow: true };
    }
    return null;
  }

  private branchLine(branch: VersionStatus, state: ConnectorState) {
    return (state === 'followed' ? FOLLOWED_BRANCH_LINE[branch] : null) ?? IDLE_BRANCH_LINE;
  }

  private toNodeView(node: RouteNode, onMainLine: boolean): NodeView {
    const classes = STATUS_CLASSES[node.status];
    const label = this.transloco.translate(STATUS_LABEL_KEY[node.status]);
    const meaning = this.transloco.translate(STATUS_MEANING_KEY[node.status]);
    const base = {
      status: node.status,
      state: node.state,
      current: node.state === 'current',
      labelKey: STATUS_LABEL_KEY[node.status],
      title: `${label} (${node.status}) · ${meaning}`,
      glyph: STATUS_GLYPH[node.status],
    };
    switch (node.state) {
      case 'current':
        return {
          ...base,
          circleClasses: `${classes.current} ${CURRENT_NODE_CLASSES}`,
          labelClasses: classes.ink,
          note: this.currentNote(node),
          noteClasses: classes.ink,
        };
      case 'visited':
        return {
          ...base,
          glyph: onMainLine ? VISITED_GLYPH : base.glyph,
          circleClasses: onMainLine ? VISITED_MAIN_CLASSES : classes.soft,
          labelClasses: VISITED_LABEL_CLASSES,
          note: node.reachedBy ? momentLabel(this.transloco, node.reachedBy.occurredAt) : '',
          noteClasses: VISITED_NOTE_CLASSES,
        };
      case 'idle':
        return {
          ...base,
          circleClasses: IDLE_NODE_CLASSES,
          labelClasses: IDLE_LABEL_CLASSES,
          note: '',
          noteClasses: IDLE_LABEL_CLASSES,
        };
    }
  }

  /** What the map says under the status the version is in: whose it is, who holds it, since when. */
  private currentNote(node: RouteNode): string {
    const version = this.version();
    const arrival = node.reachedBy;
    const when = arrival ? momentLabel(this.transloco, arrival.occurredAt) : '';
    const note = (key: string, params: Record<string, unknown> = {}) =>
      this.transloco.translate(`content.workflow.note.${key}`, params);
    switch (node.status) {
      case 'DRAFT':
        return this.transloco.translate('content.detail.by', { author: this.who(version.author) });
      case 'IN_REVIEW':
        return this.reviewNote(version, when);
      case 'REJECTED':
        return arrival ? note('byWhen', { actor: this.who(arrival.actor), when }) : '';
      case 'READY_TO_PUBLISH':
        return arrival ? note('byActor', { actor: this.who(arrival.actor) }) : '';
      case 'PUBLISHED':
        return this.transloco.translate('content.list.online', { version: version.number });
      case 'ARCHIVED':
        return note('archived');
      case 'RETIRED':
        return note('retired');
      case 'SUPERSEDED':
        return note('superseded');
    }
  }

  private reviewNote(version: VersionSummary, queuedSince: string): string {
    const claimant = version.claimant;
    if (!claimant) {
      return queuedSince
        ? this.transloco.translate('content.workflow.note.queued', { when: queuedSince })
        : '';
    }
    return this.isMe(claimant.username)
      ? this.transloco.translate('content.workflow.note.claimedByYou')
      : this.transloco.translate('content.workflow.note.claimedBy', {
          reviewer: claimant.username,
        });
  }

  private who(user: { username: string }): string {
    return this.isMe(user.username) ? this.transloco.translate('content.list.you') : user.username;
  }

  private isMe(username: string): boolean {
    return username === this.currentUser.me.value()?.username;
  }
}
