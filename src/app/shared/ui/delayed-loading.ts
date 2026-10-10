import { DestroyRef, effect, inject, signal, untracked, type Signal } from '@angular/core';

/** How long a load may take before its indicator shows: a quicker one never shows it. */
export const LOADING_DELAY_MS = 300;
/** How long an indicator, once shown, stays up: it never just flashes by. */
export const LOADING_MIN_VISIBLE_MS = 500;

/**
 * Whether to show the indicator of a load (the Sunny): only once `loading` has lasted
 * `LOADING_DELAY_MS`, then for at least `LOADING_MIN_VISIBLE_MS` - the "delay, then minimum
 * duration" pattern of loading indicators, so a quick answer shows nothing and a slow one
 * no flash. Call it in an injection context.
 */
export function delayedLoading(loading: Signal<boolean>): Signal<boolean> {
  const visible = signal(false);
  let shownAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => clearTimeout(timer);

  effect(() => {
    const isLoading = loading();
    untracked(() => {
      clear();
      if (isLoading && !visible()) {
        timer = setTimeout(() => {
          shownAt = Date.now();
          visible.set(true);
        }, LOADING_DELAY_MS);
      } else if (!isLoading && visible()) {
        const left = LOADING_MIN_VISIBLE_MS - (Date.now() - shownAt);
        timer = setTimeout(() => visible.set(false), Math.max(left, 0));
      }
    });
  });
  inject(DestroyRef).onDestroy(clear);

  return visible.asReadonly();
}
