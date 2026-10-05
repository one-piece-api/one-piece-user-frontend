import { Component, input } from '@angular/core';

/**
 * A modal's close button: a native `<button>`, so focus and keyboard stay the platform's own;
 * the caller's `(click)` on the element receives the button's click as it bubbles. The cross
 * is drawn, not typed: a glyph changes shape with the font. Lifts like the other buttons, no
 * rotation (UI guidelines).
 */
@Component({
  selector: 'app-close-button',
  template: `
    <button
      type="button"
      [attr.aria-label]="label()"
      class="grid size-9 cursor-pointer place-items-center rounded-full bg-ocean-100 text-ocean-800 shadow-sm ring-1 ring-ocean-800/10 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-ocean-800 hover:text-parchment-100 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-treasure-500 active:translate-y-0 active:shadow-sm"
    >
      <svg viewBox="0 0 14 14" class="size-3.5" aria-hidden="true">
        <path
          d="M3 3l8 8M11 3l-8 8"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  `,
  host: { class: 'flex flex-none' },
})
export class CloseButton {
  readonly label = input.required<string>();
}
