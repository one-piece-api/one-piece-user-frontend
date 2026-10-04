import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type SortDirection = 'asc' | 'desc';

/**
 * A column header that sorts the list by its column. The arrow stays out of the way: it only
 * hints on hover or keyboard focus, and shows for real on the column the list is sorted by.
 * What a click does next is the page's choice, announced through `toggled`.
 */
@Component({
  selector: 'app-sort-header',
  template: `
    <button
      type="button"
      class="group inline-flex cursor-pointer items-center gap-1 tracking-widest uppercase hover:text-ocean-800 focus-visible:text-ocean-800"
      [class.text-ocean-800]="direction() !== null"
      [attr.aria-label]="description()"
      [title]="description()"
      (click)="toggled.emit()"
    >
      {{ label() }}
      <span
        aria-hidden="true"
        class="transition-opacity"
        [class]="
          direction() === null
            ? 'opacity-0 group-hover:opacity-50 group-focus-visible:opacity-50'
            : 'opacity-100'
        "
        >{{ direction() === 'desc' ? '↓' : '↑' }}</span
      >
    </button>
  `,
})
export class SortHeader {
  private readonly transloco = inject(TranslocoService);

  readonly label = input.required<string>();
  /** How the list is sorted by this column, or `null` when it is sorted by another one. */
  readonly direction = input<SortDirection | null>(null);
  readonly toggled = output();

  protected readonly description = computed(() => {
    this.transloco.activeLang();
    const key = `common.sort.${this.direction() ?? 'none'}`;
    return this.transloco.translate(key, { column: this.label() });
  });
}
