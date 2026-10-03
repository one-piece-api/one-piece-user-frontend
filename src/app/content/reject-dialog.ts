import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService } from '../shared/mascot/mascot';
import { REJECTION_REASON_MAX_LENGTH, REJECTION_REASON_MIN_LENGTH } from './version-transition';

/**
 * "Reject this review?" (UF-CNT-06), as in the reference mockup: what rejecting does, the
 * mandatory reason with its counter, then "Cancel" or "Reject". A reason too short is not
 * sent: the field turns red and the mascot says why. A native `<dialog>` like `ConfirmDialog` - every
 * way out other than the action counts as cancelling, and the reason starts empty each time.
 */
@Component({
  selector: 'app-reject-dialog',
  templateUrl: './reject-dialog.html',
  imports: [TranslocoPipe],
})
export class RejectDialog {
  private readonly mascot = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

  readonly open = input(false);
  /** What is being rejected: "Logia · Devil Fruit Type by nami". */
  readonly target = input.required<string>();
  /** The rejection is under way: the buttons wait for it. */
  readonly busy = input(false);

  /** The reason, without the space around it. */
  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected readonly reason = signal('');
  /** A rejection was attempted with a reason too short: from then on, the field says so in red. */
  protected readonly touched = signal(false);

  protected readonly length = computed(() => this.reason().trim().length);
  protected readonly ready = computed(() => this.length() >= REJECTION_REASON_MIN_LENGTH);
  protected readonly minLength = REJECTION_REASON_MIN_LENGTH;
  protected readonly maxLength = REJECTION_REASON_MAX_LENGTH;

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      if (this.open() && !dialog.open) {
        this.reason.set('');
        this.touched.set(false);
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected onInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected reject(): void {
    if (!this.ready()) {
      this.touched.set(true);
      this.mascot.show(this.transloco.translate('content.workflow.reject.tooShort'), 'error');
      return;
    }
    this.confirmed.emit(this.reason().trim());
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
