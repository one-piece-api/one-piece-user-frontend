import { Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService, type MascotTone } from './mascot';

type TipTopic = 'profile' | 'users' | 'roles' | 'audit';

interface Tip {
  readonly text: string;
  readonly code: string;
}

/** Translation key per topic, cycled in order every time a tip fires on that page - each
 * resolves to a `{ text, code }` object in the `mascot.tips.*` catalog. */
const TIPS: Record<TipTopic, readonly string[]> = {
  profile: ['mascot.tips.profile.tip1', 'mascot.tips.profile.tip2'],
  users: ['mascot.tips.users.tip1', 'mascot.tips.users.tip2', 'mascot.tips.users.tip3'],
  roles: ['mascot.tips.roles.tip1', 'mascot.tips.roles.tip2', 'mascot.tips.roles.tip3'],
  audit: ['mascot.tips.audit.tip1', 'mascot.tips.audit.tip2'],
};

const TIP_INTERVAL_MS = 24_000;

function topicForUrl(url: string): TipTopic | null {
  if (url.startsWith('/users')) return 'users';
  if (url.startsWith('/roles')) return 'roles';
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
  imports: [TranslocoPipe],
})
export class MascotWidget {
  protected readonly mascotService = inject(MascotService);
  protected readonly toneBorderClasses = TONE_BORDER_CLASSES;
  protected readonly toneDotClasses = TONE_DOT_CLASSES;
  protected readonly toneTitleClasses = TONE_TITLE_CLASSES;
  protected readonly toneMinimizeClasses = TONE_MINIMIZE_CLASSES;

  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
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
    const key = pool[index % pool.length];
    this.tipIndexByTopic.set(topic, index + 1);
    const tip = this.transloco.translateObject<Tip>(key);
    this.mascotService.show(tip.text, 'info', tip.code);
  }
}
