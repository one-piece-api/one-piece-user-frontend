import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  STATUS_LABEL_KEY,
  UPDATED_WITHIN_OPTIONS,
  type ContentUser,
  type VersionStatus,
} from './content.model';

/** The value a `<select>` uses for "no filter" - an empty option value. */
const NO_FILTER = '';

/**
 * The columns of the bar from the large breakpoint up, by how many filters by a value the
 * entity adds after the status - literal, so Tailwind keeps them.
 */
const GRID_COLUMNS = [
  'lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]',
  'lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]',
  'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_repeat(4,minmax(0,0.9fr))_auto]',
] as const;

/** A filter by one value of a closed set an entity declares (a bounty's validity), ready to show. */
export interface ChoiceFilterView {
  /** The query parameter it lives in, here and in the backend alike. */
  readonly key: string;
  readonly labelKey: string;
  readonly options: readonly { readonly value: string; readonly labelKey: string }[];
  /** The value chosen, or `null` for every one. */
  readonly value: string | null;
}

/** A filter by a value changed in the bar: `null` lifts it. */
export interface ChoiceFilterChange {
  readonly key: string;
  readonly value: string | null;
}

/**
 * The filter bar of an entity list - search, status, the entity's own filters by a value,
 * author, last update, reset - and the
 * result line under it. The same for every kind of content. It holds no state: the page
 * owns the filters (they live in the URL) and this only shows them and reports changes.
 */
@Component({
  selector: 'app-content-list-toolbar',
  templateUrl: './content-list-toolbar.html',
  imports: [TranslocoPipe],
})
export class ContentListToolbar {
  readonly query = input.required<string>();
  readonly status = input.required<VersionStatus | null>();
  readonly author = input.required<string | null>();
  readonly updatedWithinDays = input.required<number | null>();

  /** The statuses the caller may filter by, as the backend lists them. */
  readonly statusOptions = input.required<readonly VersionStatus[]>();
  /** Every author but the caller, who gets the "You" option instead. */
  readonly otherAuthors = input.required<readonly ContentUser[]>();
  readonly myUsername = input.required<string>();
  readonly resultLine = input.required<string>();
  /** What the search box hints at: the key differs for numbered contents, found by number too. */
  readonly searchPlaceholderKey = input('content.list.searchPlaceholder');
  /** The filters by a value the entity declares - none for most. */
  readonly choiceFilters = input<readonly ChoiceFilterView[]>([]);

  readonly queryChange = output<string>();
  readonly statusChange = output<VersionStatus | null>();
  readonly authorChange = output<string | null>();
  readonly updatedWithinDaysChange = output<number | null>();
  readonly choiceFilterChange = output<ChoiceFilterChange>();
  readonly cleared = output<void>();

  protected readonly noFilter = NO_FILTER;
  protected readonly statusLabelKey = STATUS_LABEL_KEY;
  protected readonly updatedOptions = UPDATED_WITHIN_OPTIONS;
  protected readonly gridColumns = computed(
    () => GRID_COLUMNS[Math.min(this.choiceFilters().length, GRID_COLUMNS.length - 1)],
  );

  /** Shared by the search box and the three selects. */
  protected readonly fieldClasses =
    'w-full rounded-xl border-2 border-ocean-900/15 bg-parchment-100 px-3.5 py-2.5 font-heading text-[15px] font-bold text-ocean-950 focus:border-ocean-700 focus:outline-none';

  protected onQueryInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: Event): void {
    const value = selectedValue(event);
    this.statusChange.emit(value === NO_FILTER ? null : (value as VersionStatus));
  }

  protected onAuthorChange(event: Event): void {
    const value = selectedValue(event);
    this.authorChange.emit(value === NO_FILTER ? null : value);
  }

  protected onChoiceChange(key: string, event: Event): void {
    const value = selectedValue(event);
    this.choiceFilterChange.emit({ key, value: value === NO_FILTER ? null : value });
  }

  protected onUpdatedChange(event: Event): void {
    const value = selectedValue(event);
    this.updatedWithinDaysChange.emit(value === NO_FILTER ? null : Number(value));
  }

  /** The option value of an "updated" choice: its number of days, or "no filter". */
  protected updatedOptionValue(days: number | null): string {
    return days === null ? NO_FILTER : String(days);
  }
}

function selectedValue(event: Event): string {
  return (event.target as HTMLSelectElement).value;
}
