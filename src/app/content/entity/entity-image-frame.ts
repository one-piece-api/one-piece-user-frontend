import { Component, input, linkedSignal } from '@angular/core';

/**
 * An image of a content in its 4:5 gold frame, as the card and the comparison show it - or,
 * where there is none or it cannot be loaded, the placeholder that names what is missing
 * ("Image of Mera Mera no Mi"). A plain `<img>`: the image is served on this app's origin,
 * with the session cookie, and cached by the browser for as long as its id lives.
 */
@Component({
  selector: 'app-entity-image-frame',
  template: `
    <div
      class="relative aspect-4/5 overflow-hidden rounded-2xl bg-parchment-200 ring-2 ring-treasure-400"
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

  /** The image could not be loaded: the placeholder stands in, until another one is given. */
  protected readonly broken = linkedSignal({ source: this.src, computation: () => false });
}
