import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { PageResponse } from '../../shared/http/page-response';
import { STATUS_LABEL_KEY, type ContentSummary, type VersionStatus } from '../content.model';
import { STATUS_DOT_CLASS } from '../status-badge';
import { chapterLabel, chapterOf } from './entity-story-point';
import { worldDateOf, worldDateText } from './entity-event-time';
import { EditorDialogs } from './entity-editor-dialog';
import { ENTITY, entityOf } from './entities';
import type { RelatedListSection } from './entity-definition';
import { referenceLabel, type EntityReference } from './entity-reference';

/** How many contents are listed at most; the rest is one link away. */
const LISTED = 12;

/** What a row of the listed entity shows: its names and its natural key - romaji or number. */
interface RowNames {
  readonly names: Record<string, string>;
  readonly romaji?: string | null;
  readonly number?: number | null;
  readonly [time: string]: unknown;
}

/** One content in the section, ready to render. */
interface ItemView {
  readonly id: string;
  readonly name: string;
  /** When it happens, for a section that shows it: "Ch. 1000 — …", "c. 1500". */
  readonly when: string | null;
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

  private readonly editorDialogs = inject(EditorDialogs);

  readonly section = input.required<RelatedListSection>();
  /** The content the listed ones point to. */
  readonly contentId = input.required<string>();
  /** It as a new content is given it (`createWith`): named as it is now. */
  readonly content = input<EntityReference | null>(null);
  /** Whether the caller may write contents (`content:write`). */
  readonly writable = input(false);

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
      name: this.nameOf(row, language),
      when: this.whenOf(row, language),
      status: row.status,
      dotClass: STATUS_DOT_CLASS[row.status],
      statusKey: STATUS_LABEL_KEY[row.status],
      link: listed ? [listed.route, row.id] : [],
    }));
  });

  /** "1044 · Title" for a numbered content, its name or romaji otherwise, else "unnamed". */
  private nameOf(row: ContentSummary<RowNames>, language: string): string {
    const label = referenceLabel({ id: row.id, ...row.body }, language);
    return label === row.id ? this.transloco.translate('content.list.unnamed') : label;
  }

  /** "New event with this fruit": for who may write, where the listed entity is written in a dialog. */
  protected readonly canCreate = computed(
    () =>
      !!this.section().createWith &&
      this.listed()?.editor === 'dialog' &&
      !!this.content() &&
      this.writable(),
  );

  protected create(): void {
    const listed = this.listed();
    const field = listed?.fields.find(({ key }) => key === this.section().createWith);
    const content = this.content();
    if (!listed || !field || !content) {
      return;
    }
    this.editorDialogs.open({
      entity: listed,
      preset: { [field.key]: field.kind === 'relationList' ? [content] : content },
    });
  }

  private whenOf(row: ContentSummary<RowNames>, language: string): string | null {
    const field = this.section().when;
    if (!field) {
      return null;
    }
    const value = row.body[field];
    const chapter = chapterOf(value);
    if (chapter) {
      return chapterLabel(
        (key, params) => this.transloco.translate(key, params),
        chapter,
        language,
      );
    }
    const date = worldDateOf(value);
    return date && worldDateText(date);
  }

  /** The listed entity's list, narrowed to the contents that point to this one. */
  protected readonly allQuery = computed(() => ({ [this.section().by]: this.contentId() }));
}
