import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type Params } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { CurrentUserService } from '../../identity/current-user';
import { Icon } from '../../shared/ui/icon';
import { initialsOf } from '../../shared/ui/initials';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import { Pagination } from '../../shared/ui/pagination';
import {
  STATUS_LABEL_KEY,
  STATUS_MEANING_KEY,
  actionLabelKey,
  localizedName,
  type ContentUser,
  type VersionAction,
  type VersionStatus,
} from '../content.model';
import { momentLabel } from '../moment-label';
import { STATUS_BORDER_CLASS, STATUS_GLYPH, STATUS_SOFT_CLASS } from '../status-badge';
import { VersionActions, type ActionTarget } from '../version-actions';
import {
  ACTION_LOOK,
  DASHBOARD_ROUTE,
  ENTITY_SECTION,
  hasMineScope,
  legendFor,
  rowActions,
  rowNoteKey,
  statusPageOf,
  type ActionTone,
  type EntityType,
  type StatusPage,
  type StatusRow,
} from './dashboard.model';

const ENDPOINT = '/api/content/dashboard/statuses';

/** The query parameters this page keeps its view in, so the URL restores it. */
const PARAM = {
  page: 'page',
  mine: 'mine',
  entity: 'entity',
  author: 'author',
  sort: 'sort',
} as const;

/** Where the open "From here you can" legend is remembered, per browser. */
const LEGEND_STORAGE_KEY = 'dashboard.legendOpen';

/** The colors of an action icon per tone - literal class names, so Tailwind keeps them. */
const TONE_CLASSES: Record<ActionTone, string> = {
  gold: 'bg-treasure-500 text-ocean-950 shadow-[0_3px_0_var(--color-treasure-600)]',
  green: 'bg-success-600 text-white shadow-[0_3px_0_var(--color-success-700)]',
  red: 'bg-flag-600 text-white shadow-[0_3px_0_var(--color-flag-700)]',
  blue: 'bg-ocean-100 text-ocean-800 shadow-[0_3px_0_var(--color-parchment-50)]',
  navy: 'bg-ocean-900 text-treasure-500 shadow-[0_3px_0_var(--color-ocean-950)]',
};

/** One action icon of a row, ready to render. */
interface ActionIcon {
  readonly action: VersionAction;
  readonly glyph: string;
  readonly label: string;
  readonly classes: string;
}

/** One row, ready to render. */
interface RowView {
  readonly row: StatusRow;
  readonly name: string;
  readonly link: string;
  readonly api: string;
  readonly versionParam: number;
  readonly entityLabel: string;
  readonly entityIcon: string;
  readonly author: string;
  readonly authorInitials: string;
  readonly authoredByMe: boolean;
  readonly updated: string;
  readonly claim: string | null;
  readonly claimedByMe: boolean;
  readonly actions: ActionIcon[];
  readonly note: string | null;
}

/**
 * A status page of the dashboard (UF-CNT-19): every content in one status, across kinds,
 * page by page - each by its most recent version there. Drafts can be narrowed to the
 * caller's, reviews to the ones they hold; filters by kind and author, sorted by the last
 * update. Each row offers what the caller may do with its version - the same actions as
 * its detail screen, run by the same `VersionActions` - and opens that version. The view
 * lives in the URL's query parameters, like the entity list.
 */
@Component({
  selector: 'app-dashboard-status',
  templateUrl: './dashboard-status.html',
  imports: [Icon, LoadingPlaceholder, Pagination, RouterLink, TranslocoPipe, VersionActions],
})
export class DashboardStatus {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly currentUser = inject(CurrentUserService);

  /** Bound by the router: the status page's slug, e.g. `in-review`. */
  readonly status = input.required<string>();

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  /** The status shown - the guard has made sure the slug names one. */
  protected readonly versionStatus = computed<VersionStatus>(
    () => statusPageOf(this.status())?.status ?? 'PUBLISHED',
  );

  protected readonly page = computed(() => Number(this.params().get(PARAM.page) ?? 0) || 0);
  protected readonly mine = computed(() => this.params().get(PARAM.mine) === 'true');
  protected readonly entity = computed(() => this.params().get(PARAM.entity) as EntityType | null);
  protected readonly author = computed(() => this.params().get(PARAM.author));
  protected readonly ascending = computed(() => this.params().get(PARAM.sort) === 'asc');

  /** Every row carries the accent of the page's status on its left edge, as in an entity's list. */
  protected readonly rowBorderClass = computed(() => STATUS_BORDER_CLASS[this.versionStatus()]);

  private readonly statusUrl = computed(() => `${ENDPOINT}/${this.versionStatus()}`);
  protected readonly result = httpResource<StatusPage>(
    () => `${this.statusUrl()}?${this.pageQuery()}`,
  );
  protected readonly authors = httpResource<ContentUser[]>(() => `${this.statusUrl()}/authors`);

  private readonly actions = viewChild(VersionActions);
  protected readonly acting = computed(() => this.actions()?.acting() ?? false);
  /** Reads the page again once an action is answered. */
  protected readonly reload = () => this.refresh();

  private readonly myUsername = computed(() => this.currentUser.me.value()?.username ?? '');

  protected readonly heading = computed(() => {
    const status = this.versionStatus();
    return {
      labelKey: STATUS_LABEL_KEY[status],
      meaningKey: STATUS_MEANING_KEY[status],
      glyph: STATUS_GLYPH[status],
      glyphClasses: STATUS_SOFT_CLASS[status],
    };
  });

  /** "All drafts · 5" / "My drafts · 2", where the status has a "mine" for the caller. */
  protected readonly scopes = computed(() => {
    const status = this.versionStatus();
    const current = this.result.value();
    if (!hasMineScope(status) || !current || current.mine === null) {
      return [];
    }
    const prefix = status === 'DRAFT' ? 'draft' : 'review';
    return [
      {
        mine: false,
        labelKey: `content.dashboard.status.scope.${prefix}All`,
        count: current.all,
      },
      {
        mine: true,
        labelKey: `content.dashboard.status.scope.${prefix}Mine`,
        count: current.mine,
      },
    ].map((scope) => ({ ...scope, selected: scope.mine === this.mine() }));
  });

  /** Whether "From here you can" is open: remembered per browser, closed by default. */
  protected readonly legendOpen = signal(readLegendOpen());

  protected readonly legend = computed(() => {
    const status = this.versionStatus();
    return legendFor(status, (permission) => this.currentUser.hasPermission(permission)).map(
      ({ action }) => ({
        action,
        glyph: ACTION_LOOK[action].glyph,
        labelKey:
          action === 'OPEN_NEW_VERSION'
            ? 'content.dashboard.status.legend.newDraft'
            : actionLabelKey(action, status),
        descriptionKey: `content.dashboard.status.legend.desc.${status}.${action}`,
        classes: TONE_CLASSES[ACTION_LOOK[action].tone],
      }),
    );
  });

  protected readonly entityOptions = Object.entries(ENTITY_SECTION).map(([type, section]) => ({
    type,
    labelKey: section.labelKey,
  }));

  /** The authors to filter by: the caller first, as "you", when they wrote one of the rows. */
  protected readonly authorOptions = computed(() => {
    const all = this.authors.value() ?? [];
    const me = this.myUsername();
    return {
      includesMe: all.some((user) => user.username === me),
      others: all.filter((user) => user.username !== me),
      me,
    };
  });

  protected readonly filtered = computed(() => this.entity() !== null || this.author() !== null);

  /** "3 contents", or "1 content of 3" when a filter narrows the scope shown. */
  protected readonly resultLine = computed(() => {
    this.transloco.activeLang();
    const current = this.result.value();
    if (!current) {
      return '';
    }
    const shown = current.rows.totalElements;
    const scope = this.mine() && current.mine !== null ? current.mine : current.all;
    const count = this.transloco.translate(
      shown === 1 ? 'content.dashboard.status.result.one' : 'content.dashboard.status.result.many',
      { shown },
    );
    return shown === scope
      ? count
      : `${count} ${this.transloco.translate('content.dashboard.status.result.of', { total: scope })}`;
  });

  /** "1–20 of 24", framing the current page against the whole filtered result. */
  protected readonly range = computed(() => {
    this.transloco.activeLang();
    const current = this.result.value()?.rows;
    if (!current || current.totalElements === 0) {
      return null;
    }
    const start = current.page * current.size + 1;
    const end = start + current.content.length - 1;
    return this.transloco.translate('common.range', { start, end, total: current.totalElements });
  });

  protected readonly emptyKey = computed(() => {
    const status = this.versionStatus();
    if (this.mine() && status === 'DRAFT') {
      return 'content.dashboard.status.empty.draftMine';
    }
    if (this.mine() && status === 'IN_REVIEW') {
      return 'content.dashboard.status.empty.reviewMine';
    }
    return 'content.dashboard.status.empty.any';
  });

  protected readonly rows = computed<RowView[]>(() => {
    const language = this.transloco.activeLang();
    const current = this.result.value();
    return current ? current.rows.content.map((row) => this.toRowView(row, language)) : [];
  });

  protected readonly dashboardRoute = DASHBOARD_ROUTE;

  protected selectScope(mine: boolean): void {
    this.applyFilters({ [PARAM.mine]: mine ? 'true' : null });
  }

  protected selectEntity(value: string): void {
    this.applyFilters({ [PARAM.entity]: value || null });
  }

  protected selectAuthor(value: string): void {
    this.applyFilters({ [PARAM.author]: value || null });
  }

  protected selectSort(value: string): void {
    this.applyFilters({ [PARAM.sort]: value === 'asc' ? 'asc' : null });
  }

  protected toggleSort(): void {
    this.selectSort(this.ascending() ? 'desc' : 'asc');
  }

  protected resetFilters(): void {
    this.applyFilters({ [PARAM.entity]: null, [PARAM.author]: null, [PARAM.sort]: null });
  }

  protected toggleLegend(): void {
    const open = !this.legendOpen();
    this.legendOpen.set(open);
    try {
      localStorage.setItem(LEGEND_STORAGE_KEY, open ? '1' : '0');
    } catch {
      // Storage unavailable (private window, blocked site data): the legend just forgets.
    }
  }

  protected goToPage(pageNumber: number): void {
    this.navigate({ [PARAM.page]: pageNumber || null });
  }

  /** Runs an action from a row, without opening it. */
  protected act(event: Event, view: RowView, action: VersionAction): void {
    event.stopPropagation();
    this.actions()?.run(this.targetOf(view), action);
  }

  /**
   * Reads the current page again: the row acted on has usually left the status. A last
   * page left empty gives way to the one before it.
   */
  private async refresh(): Promise<void> {
    try {
      const current = await firstValueFrom(
        this.http.get<StatusPage>(`${this.statusUrl()}?${this.pageQuery()}`),
      );
      this.result.set(current);
      if (current.rows.content.length === 0 && current.rows.page > 0) {
        this.goToPage(Math.max(0, current.rows.totalPages - 1));
      }
    } catch {
      this.result.reload();
    }
    this.authors.reload();
  }

  private targetOf(view: RowView): ActionTarget {
    const { row } = view;
    return {
      contentUrl: view.api,
      contentRoute: view.link,
      name: view.name,
      entityLabel: view.entityLabel,
      version: {
        number: row.versionNumber,
        status: row.status,
        author: row.author,
        claimant: row.claimant,
        overrideActions: row.overrideActions,
      },
      onlineVersionNumber: row.onlineVersionNumber,
    };
  }

  /** A changed filter always starts again from the first page. */
  private applyFilters(changes: Params): void {
    this.navigate({ ...changes, [PARAM.page]: null });
  }

  /** Merges the changes into the URL; a `null` value removes its parameter. */
  private navigate(changes: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
    });
  }

  /** The backend query for the current view - only the filters that are actually set. */
  private pageQuery(): string {
    const search = new URLSearchParams({ page: String(this.page()) });
    if (this.mine()) {
      search.set('mine', 'true');
    }
    const entity = this.entity();
    if (entity) {
      search.set('entity', entity);
    }
    const author = this.author();
    if (author) {
      search.set('author', author);
    }
    search.set('sort', `updatedAt,${this.ascending() ? 'asc' : 'desc'}`);
    return search.toString();
  }

  private toRowView(row: StatusRow, language: string): RowView {
    const me = this.myUsername();
    const you = this.transloco.translate('content.list.you');
    const authoredByMe = row.author.username === me;
    const claimedByMe = row.claimant?.username === me;
    const section = ENTITY_SECTION[row.entityType];
    const noteKey = rowNoteKey(row, me);
    return {
      row,
      name:
        (row.title && (localizedName(row.title.names, language) ?? row.title.fallback)) ||
        this.transloco.translate('content.list.unnamed'),
      link: `${section.route}/${row.contentId}`,
      api: `${section.api}/${row.contentId}`,
      versionParam: row.versionNumber,
      entityLabel: this.transloco.translate(section.labelKey),
      entityIcon: section.icon,
      author: authoredByMe ? you : row.author.username,
      authorInitials: authoredByMe ? you : initialsOf(row.author.username),
      authoredByMe,
      updated: momentLabel(this.transloco, row.updatedAt),
      claim: row.claimant
        ? claimedByMe
          ? this.transloco.translate('content.dashboard.status.claim.you')
          : this.transloco.translate('content.dashboard.status.claim.other', {
              name: row.claimant.username,
            })
        : null,
      claimedByMe,
      actions: rowActions(row).map((action) => ({
        action,
        glyph: ACTION_LOOK[action].glyph,
        label: this.transloco.translate(actionLabelKey(action, row.status), {
          version: row.versionNumber,
        }),
        classes: TONE_CLASSES[ACTION_LOOK[action].tone],
      })),
      note: noteKey ? this.transloco.translate(noteKey, { author: row.author.username }) : null,
    };
  }
}

function readLegendOpen(): boolean {
  try {
    return localStorage.getItem(LEGEND_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
