import { Component, computed, input } from '@angular/core';

const IMAGE_ICON = /\.(png|svg|webp)$/;

/**
 * A decorative icon: a text glyph, or an illustration when the value is an image path (e.g.
 * `assets/devil-fruit-type.webp`). The image scales with the surrounding font size and the
 * glyph takes the surrounding text color, so callers size and tint it with plain classes.
 */
@Component({
  selector: 'app-icon',
  template: `
    @if (isImage()) {
      <img [src]="icon()" alt="" class="size-[1.4em] object-contain" />
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
