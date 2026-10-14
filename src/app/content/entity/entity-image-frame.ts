import { Component, input, linkedSignal } from '@angular/core';

/** The ratio (width / height) of the Devil Fruit's image, the frame's default. */
const DEFAULT_RATIO = 4 / 5;

/**
 * An image of a content in its gold frame, at the ratio of the entity's image profile (4:5
 * unless told otherwise) - or, where there is none or it cannot be loaded, the placeholder
 * that names what is missing ("Image of Mera Mera no Mi"). A plain `<img>`: the image is
 * served on this app's origin, with the session cookie, and cached by the browser for as
 * long as its id lives.
 */
@Component({
  selector: 'app-entity-image-frame',
  template: `
    <div
      class="relative aspect-(--ratio) overflow-hidden rounded-2xl bg-parchment-200 ring-2 ring-treasure-400"
      [style.--ratio]="ratio()"
    >
      @if (src() && !broken()) {
        <img
          [src]="src()"
          [alt]="alt()"
          class="absolute inset-0 size-full object-contain"
          loading="lazy"
          data-testid="entity-image"
          (error)="broken.set(true)"
        />
      } @else {
        <span
          class="absolute inset-0 flex items-center justify-center p-3 text-center font-heading text-[13px] font-bold text-ocean-500/70"
          data-testid="entity-image-placeholder"
          >{{ placeholder() }}</span
        >
      }
    </div>
  `,
})
export class EntityImageFrame {
  /** Where the image is - `null` for none. */
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly placeholder = input('');
  /** Width over height of the frame: the image profile's `width / height`. */
  readonly ratio = input(DEFAULT_RATIO);

  /** The image could not be loaded: the placeholder stands in, until another one is given. */
  protected readonly broken = linkedSignal({ source: this.src, computation: () => false });
}
