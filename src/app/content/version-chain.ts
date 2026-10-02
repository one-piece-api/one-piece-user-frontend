import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { STATUS_LABEL_KEY, type VersionStatus, type VersionSummary } from './content.model';
import { momentLabel } from './moment-label';

/** How a circle of the chain is painted per status - literal class names, so Tailwind keeps them. */
const CIRCLE_CLASSES: Record<VersionStatus, { selected: string; idle: string; caption: string }> = {
  DRAFT: {
    selected: 'border-status-draft-accent bg-status-draft-accent shadow-status-draft-accent/70',
    idle: 'border-status-draft-accent text-status-draft-ink',
    caption: 'text-status-draft-ink',
  },
  IN_REVIEW: {
    selected: 'border-status-review-accent bg-status-review-accent shadow-status-review-accent/70',
    idle: 'border-status-review-accent text-status-review-ink',
    caption: 'text-status-review-ink',
  },
  REJECTED: {
    selected:
      'border-status-rejected-accent bg-status-rejected-accent shadow-status-rejected-accent/70',
    idle: 'border-status-rejected-accent text-status-rejected-ink',
    caption: 'text-status-rejected-ink',
  },
  READY_TO_PUBLISH: {
    selected: 'border-status-ready-accent bg-status-ready-accent shadow-status-ready-accent/70',
    idle: 'border-status-ready-accent text-status-ready-ink',
    caption: 'text-status-ready-ink',
  },
  PUBLISHED: {
    selected:
      'border-status-published-accent bg-status-published-accent shadow-status-published-accent/70',
    idle: 'border-status-published-accent text-status-published-ink',
    caption: 'text-status-published-ink',
  },
  ARCHIVED: {
    selected:
      'border-status-archived-accent bg-status-archived-accent shadow-status-archived-accent/70',
    idle: 'border-status-archived-accent text-status-archived-ink',
    caption: 'text-status-archived-ink',
  },
  RETIRED: {
    selected:
      'border-status-retired-accent bg-status-retired-accent shadow-status-retired-accent/70',
    idle: 'border-status-retired-accent text-status-retired-ink',
    caption: 'text-status-retired-ink',
  },
  SUPERSEDED: {
    selected:
      'border-status-superseded-accent bg-status-superseded-accent shadow-status-superseded-accent/70',
    idle: 'border-status-superseded-accent text-status-superseded-ink',
    caption: 'text-status-superseded-ink',
  },
};

/**
 * What says "this is the one on screen": a larger circle that slowly pulses, glowing in the
 * color its status brings and sending out ripples of it, like a pebble dropped in water.
 */
const SELECTED_CLASSES =
  'anim-selected-pulse scale-110 text-white shadow-[0_0_12px_2px_var(--tw-shadow-color)]';
/** The others step back - smaller and faded - and come forward again under the pointer or focus. */
const IDLE_CLASSES =
  'cursor-pointer scale-90 opacity-60 shadow-sm hover:-translate-y-0.5 hover:scale-100 hover:opacity-100 focus-visible:scale-100 focus-visible:opacity-100';
const ONLINE_CAPTION_CLASSES = 'bg-status-published-accent text-white';
const IDLE_CAPTION_CLASSES = 'text-ocean-500/60';

/** One circle of the chain, ready to render. */
interface LinkView {
  readonly number: number;
  readonly label: string;
  readonly title: string;
  readonly selected: boolean;
  readonly online: boolean;
  readonly neverPublished: boolean;
  readonly circleClasses: string;
  readonly captionKey: string | null;
  readonly captionClasses: string;
}

/**
 * The version chain of a content (UF-CNT-12): one circle per version the caller may see,
 * the most recent first. A dashed border marks a version that was never online, an anchor
 * the one online now; the selected one is filled with the color of its status, and pulses
 * inside a halo of that color.
 */
@Component({
  selector: 'app-version-chain',
  templateUrl: './version-chain.html',
  imports: [TranslocoPipe],
})
export class VersionChain {
  private readonly transloco = inject(TranslocoService);

  /** The visible versions, oldest first - as the API returns them. */
  readonly versions = input.required<readonly VersionSummary[]>();
  readonly selectedNumber = input.required<number | null>();
  readonly onlineVersionNumber = input.required<number | null>();

  readonly picked = output<number>();

  protected readonly links = computed<LinkView[]>(() => {
    this.transloco.activeLang();
    return this.versions()
      .map((version) => this.toLinkView(version))
      .reverse();
  });

  private toLinkView(version: VersionSummary): LinkView {
    const selected = version.number === this.selectedNumber();
    const online = version.number === this.onlineVersionNumber();
    const classes = CIRCLE_CLASSES[version.status];
    return {
      number: version.number,
      label: `v${version.number}`,
      title: this.titleOf(version),
      selected,
      online,
      neverPublished: !version.everPublished,
      circleClasses: selected
        ? `${classes.selected} ${SELECTED_CLASSES}`
        : `${classes.idle} ${IDLE_CLASSES} ${online ? 'bg-status-published-soft' : 'bg-white'}`,
      captionKey: this.captionKeyOf(version, online),
      captionClasses: this.captionClassesOf(selected, online, classes.caption),
    };
  }

  /** "online" for the version online now, nothing for a superseded one, else its status. */
  private captionKeyOf(version: VersionSummary, online: boolean): string | null {
    if (online) {
      return 'content.detail.online';
    }
    return version.status === 'SUPERSEDED' ? null : STATUS_LABEL_KEY[version.status];
  }

  private captionClassesOf(selected: boolean, online: boolean, statusInk: string): string {
    if (online) {
      return ONLINE_CAPTION_CLASSES;
    }
    return selected ? statusInk : IDLE_CAPTION_CLASSES;
  }

  /** The tooltip: "v2 · Draft · today 08:45 · never published". */
  private titleOf(version: VersionSummary): string {
    const parts = [
      `v${version.number}`,
      this.transloco.translate(STATUS_LABEL_KEY[version.status]),
      momentLabel(this.transloco, version.createdAt),
    ];
    if (!version.everPublished) {
      parts.push(this.transloco.translate('content.detail.neverPublished'));
    }
    return parts.join(' · ');
  }
}
