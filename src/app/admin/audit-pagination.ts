import { Component, computed, input, output } from '@angular/core';

/**
 * The Ship's Log range/page/nav-buttons row (Step 17), used both above and below the
 * results so navigating never requires scrolling back up - extracted once that row grew
 * responsive behavior (`Page X of Y` dropped below `sm`, a windowed page-number list so a
 * ten-plus-page log never turns into a wall of buttons) that duplicating in
 * `audit-page.html` twice would have risked drifting. The range pill and the nav buttons
 * always share one row, at every width - only the `Page X of Y` label is width-gated.
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

  /**
   * The standard "1 … 4 5 6 … 10" pagination shape: the first and last page stay pinned so
   * either end is always one click away, and a sliding window of one sibling on each side
   * keeps the current page visible as you page through - instead of a static list that can
   * scroll past ten-plus pages, or a fixed leading window that hides the current page once
   * you move beyond it. An `'ellipsis'` marker fills a gap only where one actually exists;
   * small enough totals just show every page.
   */
  protected pageItems(): (number | 'ellipsis')[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const siblingCount = 1;
    const boundaryCount = 1;

    if (total <= boundaryCount * 2 + siblingCount * 2 + 3) {
      return Array.from({ length: total }, (_, i) => i);
    }

    const shownPages = new Set<number>();
    for (let page = 0; page < boundaryCount; page++) shownPages.add(page);
    for (let page = total - boundaryCount; page < total; page++) shownPages.add(page);
    for (let page = current - siblingCount; page <= current + siblingCount; page++) {
      if (page >= 0 && page < total) shownPages.add(page);
    }

    const sortedPages = Array.from(shownPages).sort((a, b) => a - b);
    const items: (number | 'ellipsis')[] = [];
    sortedPages.forEach((page, index) => {
      if (index > 0 && page - sortedPages[index - 1] > 1) {
        items.push('ellipsis');
      }
      items.push(page);
    });
    return items;
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
