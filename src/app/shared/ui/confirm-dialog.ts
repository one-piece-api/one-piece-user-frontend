import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * What the action being confirmed does: destroys something, moves it on, sets it aside, or
 * takes it offline.
 */
export type ConfirmTone = 'danger' | 'primary' | 'archive' | 'retire';

/** The "!" disc and the confirm button per tone - literal class names, so Tailwind keeps them. */
const TONE_CLASSES: Record<ConfirmTone, { icon: string; button: string }> = {
  danger: {
    icon: 'bg-flag-100 text-flag-700',
    button: 'bg-flag-600 hover:bg-flag-700',
  },
  primary: {
    icon: 'bg-ocean-100 text-ocean-800',
    button: 'bg-ocean-700 hover:bg-ocean-800',
  },
  archive: {
    icon: 'bg-status-archived-soft text-status-archived-ink',
    button: 'bg-status-archived-ink hover:bg-status-archived-accent',
  },
  retire: {
    icon: 'bg-status-retired-soft text-status-retired-ink',
    button: 'bg-status-retired-ink hover:bg-status-retired-accent',
  },
};

/**
 * "Are you sure?" before an action that cannot be taken back, as in the reference mockup:
 * a title, what will happen, a note on what remains, then "Cancel" or the action itself.
 * A native `<dialog>` (`showModal()`), like `Modal`: focus trapping, ESC and the backdrop
 * come with the element. Every way out other than the action counts as cancelling.
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  imports: [TranslocoPipe],
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  /** Shown apart, under the body: what the action leaves behind. */
  readonly note = input<string | null>(null);
  readonly confirmLabel = input.required<string>();
  readonly tone = input<ConfirmTone>('primary');
  /** The action is under way: the buttons wait for it. */
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly toneClasses = computed(() => TONE_CLASSES[this.tone()]);

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  /** ESC and the backdrop close the dialog without a word: that is a "cancel" too. */
  protected onClose(): void {
    if (this.open()) {
      this.cancelled.emit();
    }
  }

  protected onBackdropClick(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog && !this.busy()) {
      dialog.close();
    }
  }
}
