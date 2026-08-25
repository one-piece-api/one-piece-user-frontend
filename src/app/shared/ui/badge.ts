import { Component, computed, input } from '@angular/core';

export type BadgeTone = 'gold' | 'navy' | 'success' | 'neutral' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  gold: 'border-treasure-400 bg-treasure-100 text-treasure-700',
  navy: 'border-ocean-700/30 bg-ocean-900/5 text-ocean-900',
  success: 'border-success-500/40 bg-success-100 text-success-700',
  neutral: 'border-ocean-900/15 bg-ocean-900/5 text-ocean-700',
  danger: 'border-flag-500/40 bg-flag-500/10 text-flag-700',
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
      `inline-block rounded-full border px-3 py-1 font-heading text-xs font-semibold ${TONE_CLASSES[this.tone()]}`,
  );
}
