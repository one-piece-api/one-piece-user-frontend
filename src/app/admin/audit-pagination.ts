import { Component, computed, input, output } from '@angular/core';

/**
 * The Ship's Log range/page/nav-buttons row (Step 17), used both above and below the
 * results so navigating never requires scrolling back up - extracted once that row grew
 * responsive behavior (`Page X of Y` dropped below `sm`, scrollable page numbers so a
 * narrow screen never wraps into a messy grid) that duplicating in `audit-page.html`
 * twice would have risked drifting. The range pill and the nav buttons always share one
 * row, at every width - only the `Page X of Y` label is width-gated.
 */
@Component({
  selector: 'app-audit-pagination',
  templateUrl: './audit-pagination.html',
})
export class AuditPagination {
  readonly range = input<string | null>(null);
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();

  readonly previous = output<void>();
  readonly next = output<void>();
  readonly jumpTo = output<number>();

  protected readonly hasPrevious = computed(() => this.currentPage() > 0);
  protected readonly hasNext = computed(() => this.currentPage() + 1 < this.totalPages());

  /** Same gold tone as every other primary action in the app (`buttonClasses('primary')`). */
  protected readonly pageArrowClasses =
    'flex-none cursor-pointer rounded-lg bg-treasure-500 px-3 py-2 font-heading text-sm font-bold text-ocean-950 shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-treasure-400 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-treasure-500 disabled:hover:shadow-sm';

  protected pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  /** Highlights the current page among the numbered pagination buttons. */
  protected pageButtonClasses(pageNumber: number): string {
    const base =
      'flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg font-display text-sm font-bold shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0';
    return this.currentPage() === pageNumber
      ? `${base} bg-treasure-500 text-ocean-950`
      : `${base} bg-parchment-100 text-ocean-900 ring-1 ring-ocean-900/15 hover:ring-ocean-700/40`;
  }
}
