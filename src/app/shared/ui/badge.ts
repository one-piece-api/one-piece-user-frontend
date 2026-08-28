import { Component, computed, input } from '@angular/core';

export type BadgeTone = 'gold' | 'navy' | 'success' | 'neutral' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  gold: 'border-treasure-400 bg-treasure-100 text-treasure-700',
  navy: 'border-ocean-700/30 bg-ocean-900/5 text-ocean-900',
  success: 'border-success-500/40 bg-success-100 text-success-700',
  neutral: 'border-ocean-900/15 bg-ocean-900/5 text-ocean-700',
  danger: 'border-flag-500/40 bg-flag-500/10 text-flag-700',
};

/** A tone's accent color, reused for the badge's optional leading dot. */
export const TONE_ACCENT_CLASS: Record<BadgeTone, string> = {
  gold: 'bg-treasure-500',
  navy: 'bg-ocean-700',
  success: 'bg-success-500',
  neutral: 'bg-ocean-900/30',
  danger: 'bg-flag-500',
};

/** The same accent as a left-border color, e.g. the User Detail card's status stripe. */
export const TONE_BORDER_CLASS: Record<BadgeTone, string> = {
  gold: 'border-l-treasure-500',
  navy: 'border-l-ocean-700',
  success: 'border-l-success-500',
  neutral: 'border-l-ocean-900/30',
  danger: 'border-l-flag-500',
};

@Component({
  selector: 'app-badge',
  templateUrl: './badge.html',
})
export class Badge {
  readonly tone = input<BadgeTone>('gold');
  /** Lets a `@for` loop stagger a burst of badges instead of popping in all at once. */
  readonly delayMs = input(0);
  /** Prepends a small tone-colored dot, matching the mockup's status pills. */
  readonly dot = input(false);

  protected readonly classes = computed(
    () =>
      `inline-flex items-center rounded-full border px-3 py-1 font-heading text-xs font-semibold ${TONE_CLASSES[this.tone()]}`,
  );
  protected readonly dotClass = computed(() => TONE_ACCENT_CLASS[this.tone()]);
}
