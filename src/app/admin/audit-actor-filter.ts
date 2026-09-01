import {
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * The Ship's Log "Author" filter - a searchable single-select dropdown over every actor
 * who has ever recorded an event. A plain `<select>` doesn't scale once the crew grows:
 * this lets the user type a substring of an email to narrow the list instead of scrolling
 * a native option list.
 */
@Component({
  selector: 'app-audit-actor-filter',
  templateUrl: './audit-actor-filter.html',
  imports: [TranslocoPipe],
})
export class AuditActorFilter {
  readonly selected = input.required<string>();
  readonly options = input.required<string[]>();
  readonly selectedChange = output<string>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popoverRef = viewChild.required<ElementRef<HTMLElement>>('popover');
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Substring match against the email, case-insensitive - the crew can get large. */
  protected readonly filteredOptions = computed(() => {
    const query = this.query().trim().toLowerCase();
    const options = this.options();
    if (!query) {
      return options;
    }
    return options.filter((actor) => actor.toLowerCase().includes(query));
  });

  constructor() {
    effect(() => {
      const popoverEl = this.popoverRef().nativeElement;
      // The show/hide calls are feature-detected rather than assumed: jsdom (this app's
      // unit test environment) doesn't implement the Popover API, so component tests can
      // still drive `open` - and exercise the positioning math below - without those
      // calls themselves throwing.
      const supportsPopover = typeof popoverEl.showPopover === 'function';
      if (this.open()) {
        this.positionPopover();
        if (supportsPopover && !popoverEl.matches(':popover-open')) {
          popoverEl.showPopover();
        }
        this.searchInputRef()?.nativeElement.focus();
      } else {
        // Reset so the next open starts from the full list, not last time's filter.
        this.query.set('');
        if (supportsPopover && popoverEl.matches(':popover-open')) {
          popoverEl.hidePopover();
        }
      }
    });
  }

  /**
   * A shown popover is promoted to the top layer, which - unlike a plain `position:
   * absolute` element - is laid out against the viewport, not the nearest positioned
   * ancestor; there's no CSS-only way to anchor it under its trigger short of the newer
   * CSS anchor-positioning API, which isn't yet reliable enough across browsers to depend
   * on here. So the trigger's own on-screen position is measured and applied as a fixed
   * coordinate each time the menu opens.
   */
  private positionPopover(): void {
    const trigger = this.triggerRef().nativeElement;
    const popoverEl = this.popoverRef().nativeElement;
    const rect = trigger.getBoundingClientRect();
    popoverEl.style.top = `${rect.bottom + 6}px`;
    popoverEl.style.left = `${rect.left}px`;
    popoverEl.style.width = `${rect.width}px`;
  }

  protected toggleMenu(): void {
    this.open.update((current) => !current);
  }

  /** Keeps `open` in sync when the browser closes the popover itself (Esc, outside click). */
  protected onNativeToggle(event: ToggleEvent): void {
    this.open.set(event.newState === 'open');
  }

  protected select(actor: string): void {
    this.selectedChange.emit(actor);
    this.open.set(false);
  }
}
