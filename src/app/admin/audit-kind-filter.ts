import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TONE_ACCENT_CLASS } from '../shared/ui/badge';
import { AUDIT_ACTION_LABEL_KEY, AUDIT_ACTION_TONE } from './audit.model';

const ACTION_KEYS = Object.keys(AUDIT_ACTION_LABEL_KEY);

/** Mirrors the template's `min-w-64` on the popover - the floor the JS-computed width must respect. */
const POPOVER_MIN_WIDTH_PX = 256;
/** Breathing room kept between the popover and the viewport edge on narrow screens. */
const VIEWPORT_MARGIN_PX = 8;

/**
 * The Ship's Log "Action type" filter - a checkbox dropdown over every real
 * `AuditAction`, each with its badge tone's dot (`AUDIT_ACTION_TONE`/`TONE_ACCENT_CLASS`).
 * The reference mockup buckets these into five broad "kinds" (invite/role/access/
 * session/security), but this app's audit trail has no login or security event types to
 * bucket - a flat list over the actions actually recorded is the faithful equivalent here,
 * not an invented taxonomy with two permanently-empty categories.
 */
@Component({
  selector: 'app-audit-kind-filter',
  templateUrl: './audit-kind-filter.html',
  imports: [TranslocoPipe],
})
export class AuditKindFilter {
  private readonly transloco = inject(TranslocoService);

  readonly selected = input.required<ReadonlySet<string>>();
  readonly toggled = output<string>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popoverRef = viewChild.required<ElementRef<HTMLElement>>('popover');
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly actionLabelKey = AUDIT_ACTION_LABEL_KEY;
  protected readonly dotClassByAction: Record<string, string> = Object.fromEntries(
    ACTION_KEYS.map((action) => [
      action,
      TONE_ACCENT_CLASS[AUDIT_ACTION_TONE[action] ?? 'neutral'],
    ]),
  );

  /** Substring match against the translated label, case-insensitive - the list can get long. */
  protected readonly filteredActionKeys = computed(() => {
    this.transloco.activeLang();
    const query = this.query().trim().toLowerCase();
    if (!query) {
      return ACTION_KEYS;
    }
    return ACTION_KEYS.filter((action) =>
      this.transloco.translate(AUDIT_ACTION_LABEL_KEY[action]).toLowerCase().includes(query),
    );
  });

  protected readonly summary = computed(() => {
    this.transloco.activeLang();
    const selected = this.selected();
    if (selected.size === 0) {
      return this.transloco.translate('audit.filters.allTypes');
    }
    if (selected.size === 1) {
      const [only] = selected;
      return AUDIT_ACTION_LABEL_KEY[only]
        ? this.transloco.translate(AUDIT_ACTION_LABEL_KEY[only])
        : only;
    }
    return this.transloco.translate('audit.filters.typesSelected', { count: selected.size });
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
   *
   * The popover is normally sized to match the trigger, but on a narrow (mobile) screen
   * the trigger itself can be narrower than the popover's `min-w-64` floor. Left pinned to
   * the trigger's own left edge, that floor would then push the popover past the right
   * edge of the viewport, so the width is clamped to the same floor here and the left
   * offset is pulled back in whenever that would otherwise happen.
   */
  private positionPopover(): void {
    const trigger = this.triggerRef().nativeElement;
    const popoverEl = this.popoverRef().nativeElement;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, POPOVER_MIN_WIDTH_PX);
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN_PX;
    const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(rect.left, maxLeft));
    popoverEl.style.top = `${rect.bottom + 6}px`;
    popoverEl.style.left = `${left}px`;
    popoverEl.style.width = `${width}px`;
  }

  protected toggleMenu(): void {
    this.open.update((current) => !current);
  }

  /** Keeps `open` in sync when the browser closes the popover itself (Esc, outside click). */
  protected onNativeToggle(event: ToggleEvent): void {
    this.open.set(event.newState === 'open');
  }

  protected toggleAction(action: string): void {
    this.toggled.emit(action);
  }
}
