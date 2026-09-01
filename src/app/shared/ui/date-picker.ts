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

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface CalendarDay {
  iso: string | null;
  label: string;
  isToday: boolean;
  isSelected: boolean;
  /** A blank filler cell, or a real day later than today - audit events can't be dated in the future. */
  disabled: boolean;
}

/** Formats an ISO `yyyy-MM-dd` date for display, in the viewer's own locale. */
export function formatIsoDateDisplay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(`${iso}T00:00:00`),
  );
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A calendar popover for picking a single date, built on the native Popover API
 * (`popover` + `showPopover()`/`hidePopover()`) rather than a hand-rolled click-outside
 * listener - the same "let the platform own dismissal" idiom `Modal` uses for `<dialog>`,
 * so light-dismiss (an outside click, Esc) and top-layer stacking come for free.
 */
@Component({
  selector: 'app-date-picker',
  templateUrl: './date-picker.html',
})
export class DatePicker {
  readonly label = input('');
  readonly value = input<string | null>(null);
  /** Which side the popover hangs from - the "To" picker sits right-aligned. */
  readonly align = input<'start' | 'end'>('start');
  readonly valueChange = output<string | null>();

  protected readonly open = signal(false);
  private readonly viewMonth = signal(toIsoDate(new Date()).slice(0, 7));

  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popoverRef = viewChild.required<ElementRef<HTMLElement>>('popover');

  protected readonly displayValue = computed(() => {
    const value = this.value();
    return value ? formatIsoDateDisplay(value) : 'dd/mm/yyyy';
  });

  protected readonly monthLabel = computed(() => {
    const [year, month] = this.viewMonth().split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    );
  });

  protected readonly weekdayLabels = WEEKDAY_LABELS;

  protected readonly weeks = computed<CalendarDay[][]>(() => {
    const [year, month] = this.viewMonth().split('-').map(Number);
    const firstOfMonth = new Date(year, month - 1, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first, matching the reference calendar
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayIso = toIsoDate(new Date());
    const selectedIso = this.value();

    const cells: (CalendarDay | null)[] = Array(startOffset).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toIsoDate(new Date(year, month - 1, day));
      cells.push({
        iso,
        label: String(day),
        isToday: iso === todayIso,
        isSelected: iso === selectedIso,
        disabled: iso > todayIso,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const blankCell: CalendarDay = {
      iso: null,
      label: '',
      isToday: false,
      isSelected: false,
      disabled: true,
    };
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7).map((cell) => cell ?? blankCell));
    }
    return weeks;
  });

  /** Today's month is as far forward as the calendar goes - there's nothing selectable beyond it. */
  protected readonly canGoToNextMonth = computed(
    () => this.viewMonth() < toIsoDate(new Date()).slice(0, 7),
  );

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

  protected toggle(): void {
    const next = !this.open();
    if (next) {
      this.viewMonth.set((this.value() ?? toIsoDate(new Date())).slice(0, 7));
    }
    this.open.set(next);
  }

  /**
   * A shown popover is promoted to the top layer, which - unlike a plain `position:
   * absolute` element - is laid out against the viewport, not the nearest positioned
   * ancestor; there's no CSS-only way to anchor it under its trigger short of the newer
   * CSS anchor-positioning API, which isn't yet reliable enough across browsers to depend
   * on here. So the trigger's own on-screen position is measured and applied as a fixed
   * coordinate each time the popover opens.
   */
  private positionPopover(): void {
    const trigger = this.triggerRef().nativeElement;
    const popoverEl = this.popoverRef().nativeElement;
    const rect = trigger.getBoundingClientRect();
    popoverEl.style.top = `${rect.bottom + 6}px`;
    if (this.align() === 'end') {
      popoverEl.style.left = 'auto';
      popoverEl.style.right = `${window.innerWidth - rect.right}px`;
    } else {
      popoverEl.style.left = `${rect.left}px`;
      popoverEl.style.right = 'auto';
    }
  }

  /** Keeps `open` in sync when the browser closes the popover itself (Esc, outside click). */
  protected onNativeToggle(event: ToggleEvent): void {
    this.open.set(event.newState === 'open');
  }

  protected previousMonth(): void {
    this.shiftMonth(-1);
  }

  protected nextMonth(): void {
    if (this.canGoToNextMonth()) {
      this.shiftMonth(1);
    }
  }

  private shiftMonth(delta: number): void {
    const [year, month] = this.viewMonth().split('-').map(Number);
    this.viewMonth.set(toIsoDate(new Date(year, month - 1 + delta, 1)).slice(0, 7));
  }

  protected pick(day: CalendarDay): void {
    if (!day.iso || day.disabled) {
      return;
    }
    this.valueChange.emit(day.iso);
    this.open.set(false);
  }

  protected pickToday(): void {
    this.valueChange.emit(toIsoDate(new Date()));
    this.open.set(false);
  }

  protected clear(): void {
    this.valueChange.emit(null);
    this.open.set(false);
  }
}
