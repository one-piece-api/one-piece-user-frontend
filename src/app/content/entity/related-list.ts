import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { PageResponse } from '../../shared/http/page-response';
import {
  localizedName,
  STATUS_LABEL_KEY,
  type ContentSummary,
  type VersionStatus,
} from '../content.model';
import { STATUS_DOT_CLASS } from '../status-badge';
import { ENTITY, entityOf } from './entities';
import type { RelatedListSection } from './entity-definition';

/** How many contents are listed at most; the rest is one link away. */
const LISTED = 12;

/** What a row of the listed entity shows: its romaji and its names. */
interface RowNames {
  readonly romaji: string | null;
  readonly names: Record<string, string>;
}

/** One content in the section, ready to render. */
interface ItemView {
  readonly id: string;
  readonly name: string;
  readonly status: VersionStatus;
  readonly dotClass: string;
  readonly statusKey: string;
  readonly link: readonly string[];
}

/**
 * "Fruits of this type": a few of the contents of another entity that point to this one, each
 * leading to its page, and a link to all of them - the other entity's list, narrowed to this
 * one. Asked of that list (`?{by}={id}&size=12`) and not carried by the version, so it shows
 * exactly what the caller sees there, with the same total as the count in the list.
 */
@Component({
  selector: 'app-related-list',
  templateUrl: './related-list.html',
  imports: [RouterLink, TranslocoPipe],
})
export class RelatedList {
  private readonly transloco = inject(TranslocoService);
  protected readonly i18n = inject(ENTITY).i18n;

  readonly section = input.required<RelatedListSection>();
  /** The content the listed ones point to. */
  readonly contentId = input.required<string>();

  /** The entity listed - `null` where the app has no section for it. */
  protected readonly listed = computed(() => entityOf(this.section().of));

  private readonly rows = httpResource<PageResponse<ContentSummary<RowNames>>>(() => {
    const listed = this.listed();
    if (!listed) {
      return undefined;
    }
    const query = new URLSearchParams({
      [this.section().by]: this.contentId(),
      size: String(LISTED),
    });
    return `${listed.api}?${query}`;
  });

  protected readonly state = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
    if (this.rows.error()) {
      return 'error';
    }
    if (!this.rows.hasValue()) {
      return 'loading';
    }
    return this.rows.value().totalElements === 0 ? 'empty' : 'ready';
  });

  protected readonly total = computed(() =>
    this.rows.hasValue() ? this.rows.value().totalElements : 0,
  );

  protected readonly items = computed<ItemView[]>(() => {
    const language = this.transloco.activeLang();
    const listed = this.listed();
    const rows = this.rows.hasValue() ? this.rows.value().content : [];
    return rows.map((row) => ({
      id: row.id,
      name:
        localizedName(row.body.names, language) ??
        row.body.romaji ??
        this.transloco.translate('content.list.unnamed'),
      status: row.status,
      dotClass: STATUS_DOT_CLASS[row.status],
      statusKey: STATUS_LABEL_KEY[row.status],
      link: listed ? [listed.route, row.id] : [],
    }));
  });

  /** The listed entity's list, narrowed to the contents that point to this one. */
  protected readonly allQuery = computed(() => ({ [this.section().by]: this.contentId() }));
}
