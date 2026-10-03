import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type Params } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject, debounceTime } from 'rxjs';
import { CurrentUserService } from '../../identity/current-user';
import type { PageResponse } from '../../shared/http/page-response';
import { MascotService } from '../../shared/mascot/mascot';
import { Breadcrumb, type Crumb } from '../../shared/ui/breadcrumb';
import { buttonClasses } from '../../shared/ui/button-variants';
import { initialsOf } from '../../shared/ui/initials';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import { Pagination } from '../../shared/ui/pagination';
import { ContentListToolbar } from '../content-list-toolbar';
import {
  localizedName,
  otherOnlineVersion,
  type ContentListSummary,
  type ContentSummary,
  type ContentUser,
  type VersionStatus,
} from '../content.model';
import { momentLabel } from '../moment-label';
import { STATUS_BORDER_CLASS, StatusBadge } from '../status-badge';

const ENDPOINT = '/api/content/devil-fruit-types';

/** How long the search box waits after the last keystroke before filtering. */
const SEARCH_DEBOUNCE_MS = 300;

/** The query parameters this page keeps its view in, so the URL restores it. */
const PARAM = {
  page: 'page',
  query: 'q',
  status: 'status',
  author: 'author',
  updated: 'updated',
} as const;

/** What a list row shows of a Devil Fruit Type version: its romaji and its names. */
interface DevilFruitTypeNames {
  romaji: string | null;
  names: Record<string, string>;
}

/** One row, ready to render: every decision already taken, the template only lays it out. */
interface RowView {
  readonly id: string;
  readonly name: string;
  readonly romaji: string;
  readonly versionTag: string;
  readonly otherOnlineVersion: number | null;
  readonly status: VersionStatus;
  readonly borderClass: string;
  readonly author: string;
  readonly authorInitials: string;
  readonly authoredByMe: boolean;
  readonly updated: string;
}

/**
 * The Devil Fruit Type section (UF-CNT-18): one row per content, by the most recent version
 * the caller may see, with search, filters and pagination done by the backend. Page and
 * filters live in the URL's query parameters, so leaving and coming back - or sharing the
 * link - shows the same view. What the caller sees and may do comes from their
 * permissions, never from a role name.
 */
@Component({
  selector: 'app-devil-fruit-type-list',
  templateUrl: './devil-fruit-type-list.html',
  imports: [
    Breadcrumb,
    ContentListToolbar,
    LoadingPlaceholder,
    Pagination,
    RouterLink,
    StatusBadge,
    TranslocoPipe,
  ],
})
export class DevilFruitTypeList {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);
  private readonly currentUser = inject(CurrentUserService);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly page = computed(() => Number(this.params().get(PARAM.page) ?? 0) || 0);
  protected readonly query = computed(() => this.params().get(PARAM.query) ?? '');
  protected readonly status = computed(
    () => this.params().get(PARAM.status) as VersionStatus | null,
  );
  protected readonly author = computed(() => this.params().get(PARAM.author));
  protected readonly updatedWithinDays = computed(() => {
    const days = this.params().get(PARAM.updated);
    return days === null ? null : Number(days);
  });

  /** What the search box shows: follows the URL, and runs ahead of it while typing. */
  protected readonly searchText = linkedSignal(() => this.query());
  private readonly typedSearches = new Subject<string>();

  protected readonly rows = httpResource<PageResponse<ContentSummary<DevilFruitTypeNames>>>(
    () => `${ENDPOINT}?${this.listQuery()}`,
  );
  protected readonly summary = httpResource<ContentListSummary>(() => `${ENDPOINT}/summary`);
  protected readonly authors = httpResource<ContentUser[]>(() => `${ENDPOINT}/authors`);

  protected readonly myUsername = computed(() => this.currentUser.me.value()?.username ?? '');
  protected readonly canWrite = computed(() => this.currentUser.hasPermission('content:write'));
  protected readonly statusOptions = computed(() => this.summary.value()?.statuses ?? []);
  protected readonly otherAuthors = computed(() =>
    (this.authors.value() ?? []).filter((author) => author.username !== this.myUsername()),
  );

  protected readonly crumbs = computed<Crumb[]>(() => {
    this.transloco.activeLang();
    return [
      { label: this.transloco.translate('content.breadcrumb.contents') },
      { label: this.transloco.translate('content.devilFruitTypes.title'), icon: DEVIL_FRUIT_TYPE_ICON },
    ];
  });

  protected readonly rowViews = computed<RowView[]>(() => {
    const language = this.transloco.activeLang();
    const rows = this.rows.hasValue() ? this.rows.value().content : [];
    return rows.map((row) => this.toRowView(row, language));
  });

  /** "20 of 24 entries · 5 yours", or the note about drafts for who cannot write. */
  protected readonly resultLine = computed(() => {
    this.transloco.activeLang();
    if (!this.rows.hasValue() || !this.summary.hasValue()) {
      return '';
    }
    const { total, mine } = this.summary.value();
    const shown = this.rows.value().totalElements;
    const countKey = total === 1 ? 'content.list.resultOne' : 'content.list.resultMany';
    const count = this.transloco.translate(countKey, { shown, total });
    const suffix = this.canWrite()
      ? this.transloco.translate('content.list.resultMine', { mine })
      : this.transloco.translate('content.list.resultDraftsHidden');
    return `${count} · ${suffix}`;
  });

  /** "1–20 of 24", framing the current page against the whole filtered result. */
  protected readonly range = computed(() => {
    this.transloco.activeLang();
    if (!this.rows.hasValue() || this.rows.value().totalElements === 0) {
      return null;
    }
    const current = this.rows.value();
    const start = current.page * current.size + 1;
    const end = start + current.content.length - 1;
    return this.transloco.translate('common.range', { start, end, total: current.totalElements });
  });

  /** Nothing at all in the section for this caller, as opposed to nothing for these filters. */
  protected readonly sectionIsEmpty = computed(
    () => this.summary.hasValue() && this.summary.value().total === 0,
  );

  protected readonly emptyTextKey = computed(() =>
    this.canWrite() ? 'content.list.emptyWriter' : 'content.list.emptyReader',
  );

  /** What the caller may do here, sentence by sentence, from their permissions. */
  protected readonly permissionLine = computed(() => {
    this.transloco.activeLang();
    const keys = [this.canWrite() ? 'content.list.perm.writer' : 'content.list.perm.reader'];
    if (this.currentUser.hasPermission('content:review')) {
      keys.push('content.list.perm.review');
    }
    if (this.currentUser.hasPermission('content:publish')) {
      keys.push('content.list.perm.publish');
    }
    return keys.map((key) => this.transloco.translate(key)).join(' ');
  });

  protected readonly newButtonClasses = buttonClasses('primary');

  constructor() {
    this.typedSearches
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((text) => this.applyFilters({ [PARAM.query]: text.trim() || null }));

    effect(() => {
      if (this.rows.error()) {
        this.mascot.show(this.transloco.translate('content.list.loadError'), 'error');
      }
    });
  }

  protected onSearchTyped(text: string): void {
    this.searchText.set(text);
    this.typedSearches.next(text);
  }

  protected setStatus(status: VersionStatus | null): void {
    this.applyFilters({ [PARAM.status]: status });
  }

  protected setAuthor(username: string | null): void {
    this.applyFilters({ [PARAM.author]: username });
  }

  protected setUpdatedWithinDays(days: number | null): void {
    this.applyFilters({ [PARAM.updated]: days });
  }

  protected clearFilters(): void {
    this.applyFilters({
      [PARAM.query]: null,
      [PARAM.status]: null,
      [PARAM.author]: null,
      [PARAM.updated]: null,
    });
  }

  protected goToPage(pageNumber: number): void {
    this.navigate({ [PARAM.page]: pageNumber || null });
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
  private listQuery(): string {
    const search = new URLSearchParams({ page: String(this.page()) });
    if (this.query()) {
      search.set('q', this.query());
    }
    const status = this.status();
    if (status) {
      search.set('status', status);
    }
    const author = this.author();
    if (author) {
      search.set('author', author);
    }
    const days = this.updatedWithinDays();
    if (days !== null) {
      search.set('updatedWithinDays', String(days));
    }
    return search.toString();
  }

  private toRowView(row: ContentSummary<DevilFruitTypeNames>, language: string): RowView {
    const { romaji, names } = row.body;
    const authoredByMe = row.author.username === this.myUsername();
    const you = this.transloco.translate('content.list.you');
    return {
      id: row.id,
      name:
        localizedName(names, language) ??
        romaji ??
        this.transloco.translate('content.list.unnamed'),
      romaji: romaji ?? this.transloco.translate('content.list.romajiMissing'),
      versionTag: `v${row.versionNumber}`,
      otherOnlineVersion: otherOnlineVersion(row),
      status: row.status,
      borderClass: STATUS_BORDER_CLASS[row.status],
      author: authoredByMe ? you : row.author.username,
      authorInitials: authoredByMe ? you : initialsOf(row.author.username),
      authoredByMe,
      updated: momentLabel(this.transloco, row.updatedAt),
    };
  }
}
