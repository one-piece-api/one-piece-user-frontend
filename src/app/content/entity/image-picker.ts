import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { ImageProfile } from './entity-definition';
import type { ImageDraft } from './entity-image';
import { checkImage } from './image-checks';
import { imageProblemWords } from './image-words';

/**
 * The "Media" area of the editor: the image of the draft at the profile's ratio, a file
 * dropped on it or chosen from the disk, and a way to remove it. A file is checked here as
 * the backend would (`image-checks.ts`) and handed to the editor only when it passes; a
 * refused one is told under the area and the image before it stays. It knows nothing of
 * saving - the editor keeps the choice in the draft.
 */
@Component({
  selector: 'app-image-picker',
  templateUrl: './image-picker.html',
  imports: [TranslocoPipe],
})
export class ImagePicker {
  private readonly transloco = inject(TranslocoService);

  /** The id of the file input, for the label that names it. */
  readonly inputId = input.required<string>();
  readonly value = input<ImageDraft | null>(null);
  readonly profile = input.required<ImageProfile>();
  /** What the image shows, said to who cannot see it - the content's name. */
  readonly alt = input('');
  /** Why the backend refused the image at the last save, already in words. */
  readonly error = input<string | null>(null);

  /** A file that passed the checks - or `null`, the image removed. */
  readonly picked = output<File | null>();

  /** The image on screen: the one saved, or the file chosen. */
  protected readonly source = computed(() => {
    const value = this.value();
    if (!value) {
      return null;
    }
    return 'saved' in value ? value.saved.url : value.preview;
  });
  /** The image could not be shown: the placeholder stands in until another is chosen. */
  protected readonly broken = linkedSignal({ source: this.source, computation: () => false });

  protected readonly checking = signal(false);
  protected readonly dragging = signal(false);
  /** Why the browser refused the last file, in words - before anything is sent. */
  private readonly refusal = signal<string | null>(null);
  protected readonly problem = computed(() => this.refusal() ?? this.error());

  /** "4:5, at least 640 × 800, PNG with a transparent background". */
  protected readonly requirements = computed(() => {
    this.transloco.activeLang();
    const { width, height } = this.profile();
    return this.transloco.translate('content.image.requirements', { width, height });
  });

  protected onFileInput(input: HTMLInputElement): void {
    const file = input.files?.[0];
    // Emptied, so choosing the same file again after a refusal is still a change.
    input.value = '';
    if (file) {
      void this.take(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      void this.take(file);
    }
  }

  protected remove(): void {
    this.refusal.set(null);
    this.picked.emit(null);
  }

  /** Checks the file as the backend would, then hands it over - or says why not. */
  private async take(file: File): Promise<void> {
    this.checking.set(true);
    this.refusal.set(null);
    try {
      const refused = await checkImage(file, this.profile());
      if (refused) {
        this.refusal.set(imageProblemWords(this.transloco, refused));
      } else {
        this.picked.emit(file);
      }
    } finally {
      this.checking.set(false);
    }
  }
}
