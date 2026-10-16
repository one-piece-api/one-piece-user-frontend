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
import { Icon } from '../../shared/ui/icon';
import { initialsOf } from '../../shared/ui/initials';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import { Pagination } from '../../shared/ui/pagination';
import { SortHeader, type SortDirection } from '../../shared/ui/sort-header';
import { contentsCrumb } from '../content-crumbs';
import { ContentListToolbar } from '../content-list-toolbar';
import {
  contentSerial,
  localizedName,
  otherOnlineVersion,
  type ContentListSummary,
  type ContentSummary,
  type ContentUser,
  type VersionStatus,
} from '../content.model';
import { formatSort, nextSort, parseSort, type ListSort } from '../list-sort';
import { momentLabel } from '../moment-label';
import { STATUS_BORDER_CLASS, StatusBadge } from '../status-badge';
import { ENTITY, entityOf } from './entities';
import { EditorDialogs } from './entity-editor-dialog';
import { naturalKeyOf } from './entity-body';
import { isNumbered, type RelationField } from './entity-definition';
import { isReference, referenceLabel, type EntityReference } from './entity-reference';

/** How long the search box waits after the last keystroke before filtering. */
const SEARCH_DEBOUNCE_MS = 300;

/** The query parameters this page keeps its view in, so the URL restores it. */
const PARAM = {
  page: 'page',
  query: 'q',
  status: 'status',
  author: 'author',
  updated: 'updated',
  sort: 'sort',
} as const;

/**
 * The columns of a list row from the small breakpoint up, by what sits between the name and the
 * status: nothing, a count, one relation or two - literal, so Tailwind keeps them. A numbered
 * entity has a narrow number column in front.
 */
const COLUMNS = {
  plain: {
    none: 'sm:grid-cols-[minmax(0,2.4fr)_13rem_minmax(0,1fr)_7rem]',
    count: 'sm:grid-cols-[minmax(0,2.4fr)_5.5rem_13rem_minmax(0,1fr)_7rem]',
    oneRelation: 'sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_13rem_minmax(0,1fr)_7rem]',
    twoRelations:
      'sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_13rem_minmax(0,1fr)_7rem]',
  },
  numbered: {
    none: 'sm:grid-cols-[3.5rem_minmax(0,2.4fr)_13rem_minmax(0,1fr)_7rem]',
    count: 'sm:grid-cols-[3.5rem_minmax(0,2.4fr)_5.5rem_13rem_minmax(0,1fr)_7rem]',
    oneRelation: 'sm:grid-cols-[3.5rem_minmax(0,2.4fr)_minmax(0,1fr)_13rem_minmax(0,1fr)_7rem]',
    twoRelations:
      'sm:grid-cols-[3.5rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_13rem_minmax(0,1fr)_7rem]',
  },
} as const;

/** The columns the list can be sorted by, named as the backend names them. */
const SORT_FIELDS = ['name', 'status', 'author', 'updatedAt'] as const;
/** A numbered entity can also be sorted by its number. */
const NUMBERED_SORT_FIELDS = [...SORT_FIELDS, 'number'] as const;
type SortField = (typeof NUMBERED_SORT_FIELDS)[number];

/** Last update, newest first: what the backend does when no sort is asked for. */
const LATEST_FIRST: ListSort<SortField> = { field: 'updatedAt', direction: 'desc' };
/** Story order: what a numbered entity lists by when no sort is asked for. */
const BY_NUMBER: ListSort<SortField> = { field: 'number', direction: 'asc' };

/**
 * What a list row shows of a version, whatever the entity: its natural key and its names - and,
 * under the key of a relation field, the content it points to.
 */
interface RowNames {
  readonly [field: string]: unknown;
  names: Record<string, string>;
}

/** The content a row points to, named for the column and leading to its page. */
interface RelationCell {
  readonly label: string;
  readonly link: readonly string[];
}

/** How many contents point to a row, and where to see them: their list, narrowed to this one. */
interface CountCell {
  readonly count: number;
  /** `null` when there are none: nothing to see. */
  readonly link: { readonly route: string; readonly query: Params } | null;
}

/** The filter "only the contents that point to this one", shown as a chip that removes it. */
interface RelationChip {
  /** The query parameter it lives in. */
  readonly key: string;
  readonly labelKey: string;
  readonly name: string;
}

/** One row, ready to render: every decision already taken, the template only lays it out. */
interface RowView {
  readonly id: string;
  readonly name: string;
  /** `null` for an entity without one. */
  readonly naturalKey: string | null;
  readonly versionTag: string;
  readonly otherOnlineVersion: number | null;
  readonly status: VersionStatus;
  readonly borderClass: string;
  readonly author: string;
  readonly authorInitials: string;
  readonly authoredByMe: boolean;
  readonly updated: string;
  /** The content the row points to, per relation of the entity - `null` where none is chosen. */
  readonly relations: readonly (RelationCell | null)[];
  /** How many contents point to the row - `null` for an entity with no such column. */
  readonly count: CountCell | null;
}

/**
 * The section of an entity (UF-CNT-18): one row per content, by the most recent version
 * the caller may see, with search, filters and pagination done by the backend. Page and
 * filters live in the URL's query parameters, so leaving and coming back - or sharing the
 * link - shows the same view. What the caller sees and may do comes from their
 * permissions, never from a role name.
 */
@Component({
  selector: 'app-entity-list',
  templateUrl: './entity-list.html',
  imports: [
    Breadcrumb,
    Icon,
    ContentListToolbar,
    LoadingPlaceholder,
    Pagination,
    RouterLink,
    SortHeader,
    StatusBadge,
    TranslocoPipe,
  ],
})
export class EntityList {
  protected readonly entity = inject(ENTITY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly editorDialogs = inject(EditorDialogs);

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
  /** The sort asked for in the URL; `null` leaves the backend's default. */
  private readonly sort = computed(() => parseSort(this.params().get(PARAM.sort), this.sortFields));
  /** Whether the contents have a number - a chapter - to sort and look them up by. */
  protected readonly numbered = isNumbered(this.entity);
  private readonly sortFields: readonly SortField[] = this.numbered
    ? NUMBERED_SORT_FIELDS
    : SORT_FIELDS;
  private readonly defaultSort = this.numbered ? BY_NUMBER : LATEST_FIRST;
  /**
   * The relations the list shows a column for and can be narrowed by - a chapter has two. The
   * key of each is the query parameter of its filter, here and in the backend alike.
   */
  protected readonly relationFields = this.entity.fields.filter(
    (field): field is RelationField => field.kind === 'relation',
  );
  /** The count of other contents pointing to each row, when the entity has one. */
  protected readonly countColumn = this.entity.counts?.[0];
  protected readonly columns = this.columnsOf();
  protected readonly searchPlaceholderKey = this.numbered
    ? 'content.list.searchPlaceholderNumbered'
    : 'content.list.searchPlaceholder';
  /** The id each relation is narrowed to in the URL - only the relations that are. */
  protected readonly relationFilters = computed(() =>
    this.relationFields.flatMap((field) => {
      const id = this.params().get(field.key);
      return id ? [{ field, id }] : [];
    }),
  );
  /** Which column the rows are actually sorted by, and how - the default included. */
  protected readonly shownSort = computed(() => this.sort() ?? this.defaultSort);

  /** What the search box shows: follows the URL, and runs ahead of it while typing. */
  protected readonly searchText = linkedSignal(() => this.query());
  private readonly typedSearches = new Subject<string>();

  protected readonly rows = httpResource<PageResponse<ContentSummary<RowNames>>>(() => {
    if (this.sort()?.field === 'name') {
      // Sorted by the name in the reading language (sent as Accept-Language): reload on a switch.
      this.transloco.activeLang();
    }
    return `${this.entity.api}?${this.listQuery()}`;
  });
  protected readonly summary = httpResource<ContentListSummary>(() => `${this.entity.api}/summary`);
  protected readonly authors = httpResource<ContentUser[]>(() => `${this.entity.api}/authors`);

  protected readonly myUsername = computed(() => this.currentUser.me.value()?.username ?? '');
  protected readonly canWrite = computed(() => this.currentUser.hasPermission('content:write'));
  protected readonly statusOptions = computed(() => this.summary.value()?.statuses ?? []);
  protected readonly otherAuthors = computed(() =>
    (this.authors.value() ?? []).filter((author) => author.username !== this.myUsername()),
  );

  protected readonly crumbs = computed<Crumb[]>(() => {
    this.transloco.activeLang();
    return [
      contentsCrumb(this.transloco),
      { label: this.transloco.translate(`${this.entity.i18n}.title`) },
    ];
  });

  protected readonly rowViews = computed<RowView[]>(() => {
    const language = this.transloco.activeLang();
    const rows = this.rows.hasValue() ? this.rows.value().content : [];
    return rows.map((row) => this.toRowView(row, language));
  });

  /**
   * One chip per relation filter: the name of the content filtered by, taken from a row that
   * points to it - none does when nothing matches - else its short serial.
   */
  protected readonly relationChips = computed<RelationChip[]>(() => {
    const language = this.transloco.activeLang();
    const rows = this.rows.hasValue() ? this.rows.value().content : [];
    return this.relationFilters().map(({ field, id }) => {
      const reference = rows
        .map((row) => row.body[field.key])
        .find(
          (candidate): candidate is EntityReference =>
            isReference(candidate) && candidate.id === id,
        );
      return {
        key: field.key,
        labelKey: `content.list.column.${field.key}`,
        name: reference ? referenceLabel(reference, language) : contentSerial(id),
      };
    });
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

  /** A new content of an entity written in a dialog: over the list, not on a page. */
  protected openNewInDialog(): void {
    this.editorDialogs.open({ entity: this.entity });
  }

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

  /** Ascending, then descending, then back to the default; like a filter, back to page one. */
  protected sortBy(field: SortField): void {
    const next = nextSort(this.sort(), field, this.defaultSort);
    this.applyFilters({ [PARAM.sort]: next && formatSort(next) });
  }

  /** The direction to show on a column header, or `null` when the rows follow another one. */
  protected sortDirectionOf(field: SortField): SortDirection | null {
    const shown = this.shownSort();
    return shown.field === field ? shown.direction : null;
  }

  protected clearFilters(): void {
    this.applyFilters({
      [PARAM.query]: null,
      [PARAM.status]: null,
      [PARAM.author]: null,
      [PARAM.updated]: null,
      ...Object.fromEntries(this.relationFields.map(({ key }) => [key, null])),
    });
  }

  /** Lifts the narrowing to the contents that point to one. */
  protected clearRelationFilter(key: string): void {
    this.applyFilters({ [key]: null });
  }

  protected goToPage(pageNumber: number): void {
    this.navigate({ [PARAM.page]: pageNumber || null });
  }

  private columnsOf(): string {
    const columns = this.numbered ? COLUMNS.numbered : COLUMNS.plain;
    if (this.relationFields.length > 1) {
      return columns.twoRelations;
    }
    if (this.relationFields.length === 1) {
      return columns.oneRelation;
    }
    return this.countColumn ? columns.count : columns.none;
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
    for (const { field, id } of this.relationFilters()) {
      search.set(field.key, id);
    }
    const days = this.updatedWithinDays();
    if (days !== null) {
      search.set('updatedWithinDays', String(days));
    }
    // The backend lists by last update unless told: a numbered entity asks for story order.
    const sort = this.numbered ? this.shownSort() : this.sort();
    if (sort) {
      search.set('sort', formatSort(sort));
    }
    return search.toString();
  }

  private toRowView(row: ContentSummary<RowNames>, language: string): RowView {
    const { names } = row.body;
    const naturalKey = naturalKeyOf(this.entity, row.body);
    const authoredByMe = row.author.username === this.myUsername();
    const you = this.transloco.translate('content.list.you');
    return {
      id: row.id,
      name:
        localizedName(names, language) ??
        naturalKey ??
        this.transloco.translate('content.list.unnamed'),
      naturalKey:
        naturalKey ??
        (this.entity.naturalKey === undefined
          ? null
          : this.transloco.translate(`content.list.${this.entity.naturalKey}Missing`)),
      versionTag: `v${row.versionNumber}`,
      otherOnlineVersion: otherOnlineVersion(row),
      status: row.status,
      borderClass: STATUS_BORDER_CLASS[row.status],
      author: authoredByMe ? you : row.author.username,
      authorInitials: authoredByMe ? you : initialsOf(row.author.username),
      authoredByMe,
      updated: momentLabel(this.transloco, row.updatedAt),
      relations: this.relationFields.map((field) => this.relationCell(row, field, language)),
      count: this.countCell(row),
    };
  }

  private countCell(row: ContentSummary<RowNames>): CountCell | null {
    const column = this.countColumn;
    const count = column && row.body[column.field];
    const counted = entityOf(column?.of);
    if (!column || typeof count !== 'number') {
      return null;
    }
    return {
      count,
      link: count > 0 && counted ? { route: counted.route, query: { [column.by]: row.id } } : null,
    };
  }

  private relationCell(
    row: ContentSummary<RowNames>,
    field: RelationField,
    language: string,
  ): RelationCell | null {
    const reference = row.body[field.key];
    const target = entityOf(field.target);
    if (!isReference(reference)) {
      return null;
    }
    return {
      label: referenceLabel(reference, language),
      link: target ? [target.route, reference.id] : [],
    };
  }
}
