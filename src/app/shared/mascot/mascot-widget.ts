import { Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MascotService, type MascotTone } from './mascot';

type TipTopic = 'profile' | 'users' | 'audit';

/** [text, small caption] per topic, cycled in order every time a tip fires on that page. */
const TIPS: Record<TipTopic, readonly (readonly [string, string])[]> = {
  profile: [
    [
      "Password and OTP live in your account settings, not here - I'm a snail-phone, not a locksmith.",
      'account settings',
    ],
    [
      'Your session renews itself while you work. If it ever sinks, we chart you straight back to the login page.',
      'session handling',
    ],
  ],
  users: [
    [
      "An expired invitation isn't lost at sea - resend it and the clock resets to seven days.",
      'POST /users/:id/resend-invitation',
    ],
    [
      'Grant a role now? The crewmate sees it shortly, not instantly - even gull-mail takes its time.',
      'role changes propagate',
    ],
    [
      'The last ADMIN is protected - a ship with no captain just drifts in circles.',
      '409 USER_LAST_ADMINISTRATOR',
    ],
  ],
  audit: [
    [
      "The ship's log is never erased. Not even the sharpest first mate can rewrite a route already sailed.",
      'append-only',
    ],
    [
      'Here you see who did what, and when - handy when someone swears they never touched a thing.',
      'audit:read',
    ],
  ],
};

const TIP_INTERVAL_MS = 24_000;

function topicForUrl(url: string): TipTopic | null {
  if (url.startsWith('/users')) return 'users';
  if (url.startsWith('/audit')) return 'audit';
  if (url === '/' || url.startsWith('/?')) return 'profile';
  return null;
}

const TONE_BORDER_CLASSES: Record<MascotTone, string> = {
  info: 'border-ocean-700',
  success: 'border-success-500',
  error: 'border-flag-600',
};

const TONE_DOT_CLASSES: Record<MascotTone, string> = {
  info: 'bg-ocean-700',
  success: 'bg-success-500',
  error: 'bg-flag-600',
};

const TONE_TITLE_CLASSES: Record<MascotTone, string> = {
  info: 'text-ocean-900',
  success: 'text-success-700',
  error: 'text-flag-700',
};

const TONE_MINIMIZE_CLASSES: Record<MascotTone, string> = {
  info: 'bg-ocean-100 text-ocean-900',
  success: 'bg-success-100 text-success-700',
  error: 'bg-flag-100 text-flag-700',
};

/**
 * The floating Den Den Mushi: an always-visible launcher when collapsed, a single-message
 * bubble when open. Also pipes up on its own every so often with a tip for whatever page
 * the crew is currently on (see `TIPS`) - a port of the reference mockup's `_tip` interval.
 */
@Component({
  selector: 'app-mascot-widget',
  templateUrl: './mascot-widget.html',
})
export class MascotWidget {
  protected readonly mascotService = inject(MascotService);
  protected readonly toneBorderClasses = TONE_BORDER_CLASSES;
  protected readonly toneDotClasses = TONE_DOT_CLASSES;
  protected readonly toneTitleClasses = TONE_TITLE_CLASSES;
  protected readonly toneMinimizeClasses = TONE_MINIMIZE_CLASSES;

  private readonly router = inject(Router);
  private readonly tipIndexByTopic = new Map<TipTopic, number>();

  constructor() {
    const intervalId = setInterval(() => this.showNextTip(), TIP_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

  private showNextTip(): void {
    const topic = topicForUrl(this.router.url);
    if (!topic) {
      return;
    }
    const pool = TIPS[topic];
    const index = this.tipIndexByTopic.get(topic) ?? 0;
    const [text, code] = pool[index % pool.length];
    this.tipIndexByTopic.set(topic, index + 1);
    this.mascotService.show(text, 'info', code);
  }
}
