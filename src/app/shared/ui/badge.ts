import { Component, computed, input } from '@angular/core';

export type BadgeTone = 'gold' | 'navy' | 'flag';

const TONE_CLASSES: Record<BadgeTone, string> = {
  gold: 'border-treasure-500 bg-treasure-100 text-treasure-600',
  navy: 'border-ocean-700 bg-ocean-900/5 text-ocean-900',
  flag: 'border-flag-600 bg-flag-500/10 text-flag-600',
};

@Component({
  selector: 'app-badge',
  templateUrl: './badge.html',
})
export class Badge {
  readonly tone = input<BadgeTone>('gold');
  /** Lets a `@for` loop stagger a burst of badges instead of popping in all at once. */
  readonly delayMs = input(0);

  protected readonly classes = computed(
    () =>
      `inline-block rounded-full border-2 px-3 py-1 font-heading text-sm font-bold ${TONE_CLASSES[this.tone()]}`,
  );
}
