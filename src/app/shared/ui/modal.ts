import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/**
 * A native `<dialog>` (`showModal()`) rather than a hand-rolled overlay: focus trapping,
 * ESC-to-close and the backdrop are all built into the element itself, so there is
 * nothing extra to wire up or a library to add for something the platform already does.
 */
@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
})
export class Modal {
  readonly open = input(false);
  readonly heading = input('');
  readonly closed = output<void>();

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

  /** Fires for every close path (the ✕ button, ESC, and a backdrop click all end up here). */
  protected onClose(): void {
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) {
      dialog.close();
    }
  }
}
