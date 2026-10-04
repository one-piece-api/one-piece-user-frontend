import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService } from '../shared/mascot/mascot';
import { contentSerial } from './content.model';

/**
 * The short serial of a content (`#3F2A9C1B`), beside its kind in a detail header: a tooltip
 * says what it is, a click copies it to the clipboard and the mascot confirms.
 */
@Component({
  selector: 'app-content-serial',
  imports: [TranslocoPipe],
  template: `
    <button
      type="button"
      class="cursor-copy rounded-md px-1 tracking-wider text-ocean-500/60 uppercase transition-colors hover:bg-ocean-100 hover:text-ocean-800 focus-visible:outline-2 focus-visible:outline-ocean-700"
      [title]="'content.detail.serial.tooltip' | transloco"
      (click)="copy()"
    >
      {{ serial() }}
    </button>
  `,
})
export class ContentSerial {
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);

  readonly contentId = input.required<string>();

  protected readonly serial = computed(() => contentSerial(this.contentId()));

  protected async copy(): Promise<void> {
    const serial = this.serial();
    try {
      await navigator.clipboard.writeText(serial);
      this.mascot.show(
        this.transloco.translate('content.detail.serial.copied', { serial }),
        'success',
      );
    } catch {
      this.mascot.show(this.transloco.translate('content.detail.serial.copyFailed'), 'error');
    }
  }
}
