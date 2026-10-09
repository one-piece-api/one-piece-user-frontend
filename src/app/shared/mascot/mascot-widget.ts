import { Component, DestroyRef, ElementRef, effect, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService, type MascotTone } from './mascot';

type TipTopic = 'profile' | 'users' | 'roles' | 'audit' | 'languages' | 'dashboard' | 'content';

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
  languages: ['mascot.tips.languages.tip1', 'mascot.tips.languages.tip2'],
  dashboard: ['mascot.tips.dashboard.tip1', 'mascot.tips.dashboard.tip2'],
  content: [
    'mascot.tips.content.tip1',
    'mascot.tips.content.tip2',
    'mascot.tips.content.tip3',
    'mascot.tips.content.tip4',
  ],
};

/** Sparse enough that a tip stays a nudge, not the thing the eye learns to skip. */
export const TIP_INTERVAL_MS = 50_000;

function topicForUrl(url: string): TipTopic | null {
  if (url.startsWith('/users')) return 'users';
  if (url.startsWith('/roles')) return 'roles';
  if (url.startsWith('/audit')) return 'audit';
  if (url.startsWith('/languages')) return 'languages';
  if (url.startsWith('/profile')) return 'profile';
  if (url.startsWith('/dashboard')) return 'dashboard';
  if (url.startsWith('/content')) return 'content';
  return null;
}

/** How a tone looks - literal class names, so Tailwind keeps them. */
interface ToneStyle {
  readonly bubble: string;
  readonly header: string;
  readonly title: string;
  /** The mark before the title: a dot, or a glyph badge for an outcome. */
  readonly mark: { readonly classes: string; readonly glyph: string };
  readonly minimize: string;
}

/** A tip and a system message: the navy border and the snail's own "Puru puru puru". */
const NAVY_STYLE: ToneStyle = {
  bubble: 'border-[3px] border-ocean-700 shadow-2xl',
  header: 'px-4 pt-4',
  title: 'text-sm text-ocean-900',
  mark: { classes: 'size-2 bg-ocean-700', glyph: '' },
  minimize: 'bg-ocean-100 text-ocean-900',
};

/**
 * A visual hierarchy, so an outcome is never mistaken for one more tip: tips and system
 * messages share the navy look; an outcome of the user's action gets a filled colored header
 * with a glyph, and makes the snail buzz.
 */
const TONE_STYLES: Record<MascotTone, ToneStyle> = {
  tip: NAVY_STYLE,
  info: NAVY_STYLE,
  success: {
    bubble: 'border-[3px] border-success-500 shadow-2xl',
    header: 'bg-success-500 px-4 py-2.5 text-white',
    title: 'text-[15px] text-white',
    mark: { classes: 'size-5.5 bg-white text-xs text-success-700', glyph: '✓' },
    minimize: 'bg-white/25 text-white',
  },
  error: {
    bubble: 'border-[3px] border-flag-600 shadow-2xl',
    header: 'bg-flag-600 px-4 py-2.5 text-white',
    title: 'text-[15px] text-white',
    mark: { classes: 'size-5.5 bg-white text-xs text-flag-700', glyph: '!' },
    minimize: 'bg-white/25 text-white',
  },
};

const OUTCOME_TONES: ReadonlySet<MascotTone> = new Set(['success', 'error']);

/**
 * The floating Den Den Mushi: an always-visible launcher when collapsed, a single-message
 * bubble when open. Also pipes up on its own every so often with a tip for whatever page
 * the crew is currently on (see `TIPS`) - a port of the reference mockup's `_tip` interval.
 *
 * It lives in the browser's top layer as a manual popover: a modal `<dialog>` sits there
 * too, above anything a z-index can reach, and would otherwise hide what the mascot says
 * while it is open. Each new message reopens the popover, which puts it back on top of the
 * top layer - above whichever dialog is open at that moment.
 */
@Component({
  selector: 'app-mascot-widget',
  templateUrl: './mascot-widget.html',
  imports: [TranslocoPipe],
})
export class MascotWidget {
  protected readonly mascotService = inject(MascotService);
  protected readonly toneStyles = TONE_STYLES;

  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly tipIndexByTopic = new Map<TipTopic, number>();
  private readonly layer = viewChild.required<ElementRef<HTMLElement>>('layer');

  constructor() {
    effect(() => {
      this.mascotService.message();
      this.mascotService.open();
      raiseToTop(this.layer().nativeElement);
    });
    const intervalId = setInterval(() => this.showNextTip(), TIP_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

  protected isOutcome(tone: MascotTone): boolean {
    return OUTCOME_TONES.has(tone);
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
    this.mascotService.showTip(tip.text, tip.code);
  }
}

/** Shows the popover again, last in the top layer - so above everything shown before it. */
function raiseToTop(popover: HTMLElement): void {
  // jsdom has no popover API yet; every browser this app targets has.
  if (typeof popover.showPopover !== 'function') {
    return;
  }
  popover.hidePopover();
  popover.showPopover();
}
