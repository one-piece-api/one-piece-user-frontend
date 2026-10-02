import { Component, input, output } from '@angular/core';
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
 * The filter bar of an entity list - search, status, author, last update, reset - and the
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

  readonly queryChange = output<string>();
  readonly statusChange = output<VersionStatus | null>();
  readonly authorChange = output<string | null>();
  readonly updatedWithinDaysChange = output<number | null>();
  readonly cleared = output<void>();

  protected readonly noFilter = NO_FILTER;
  protected readonly statusLabelKey = STATUS_LABEL_KEY;
  protected readonly updatedOptions = UPDATED_WITHIN_OPTIONS;

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
