import { Component, computed, input } from '@angular/core';

const IMAGE_ICON = /\.(png|svg|webp)$/;

/**
 * A decorative icon: a text glyph, or an illustration when the value is an image path (e.g.
 * `assets/devil-fruit-type.webp`). A glyph takes the surrounding text size and color; an
 * illustration has one fixed size everywhere, larger than its box and lifted by a soft shadow,
 * so it seems to come out of it. The negative vertical margins keep it from making a row taller.
 */
@Component({
  selector: 'app-icon',
  template: `
    @if (isImage()) {
      <img
        [src]="icon()"
        alt=""
        class="-my-1.5 size-8 max-w-none shrink-0 -translate-y-0.5 object-contain drop-shadow-[0_5px_4px_rgba(0,0,0,0.5)]"
      />
    } @else {
      {{ icon() }}
    }
  `,
  host: { class: 'inline-flex flex-none items-center justify-center', 'aria-hidden': 'true' },
})
export class Icon {
  readonly icon = input.required<string>();

  protected readonly isImage = computed(() => IMAGE_ICON.test(this.icon()));
}
