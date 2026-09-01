import { Component, computed, effect, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { TONE_ACCENT_CLASS } from '../shared/ui/badge';
import { AUDIT_ACTION_LABEL, AUDIT_ACTION_TONE } from './audit.model';

const ACTION_KEYS = Object.keys(AUDIT_ACTION_LABEL);

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
})
export class AuditKindFilter {
  readonly selected = input.required<ReadonlySet<string>>();
  readonly toggled = output<string>();

  protected readonly open = signal(false);
  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popoverRef = viewChild.required<ElementRef<HTMLElement>>('popover');

  protected readonly actionKeys = ACTION_KEYS;
  protected readonly actionLabel = AUDIT_ACTION_LABEL;
  protected readonly dotClassByAction: Record<string, string> = Object.fromEntries(
    ACTION_KEYS.map((action) => [action, TONE_ACCENT_CLASS[AUDIT_ACTION_TONE[action] ?? 'neutral']]),
  );

  protected readonly summary = computed(() => {
    const selected = this.selected();
    if (selected.size === 0) {
      return 'All types';
    }
    if (selected.size === 1) {
      const [only] = selected;
      return AUDIT_ACTION_LABEL[only] ?? only;
    }
    return `${selected.size} types selected`;
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
      } else if (supportsPopover && popoverEl.matches(':popover-open')) {
        popoverEl.hidePopover();
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

  protected toggleAction(action: string): void {
    this.toggled.emit(action);
  }
}
