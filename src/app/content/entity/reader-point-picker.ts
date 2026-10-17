import { Component, computed, inject, input, model } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { chapterNumberOf, revealTitleOf, type TimelineNode } from './entity-reveals';

/** One point the reader may stop at, as the selector shows it. */
interface ReaderPoint {
  /** The chapter number, `?` where the draft has none yet. */
  readonly chapter: string;
  readonly label: string;
}

/**
 * "How the reader sees it" (plan timeline, TL4.6): picks a point of the timeline read forward -
 * the first appearance, then each reveal in chapter order, the last one being the current
 * truth - with the arrows or the dots. The page shows the card as the reader knows it there
 * (`readerViewAt`).
 */
@Component({
  selector: 'app-reader-point-picker',
  templateUrl: './reader-point-picker.html',
  imports: [TranslocoPipe],
})
export class ReaderPointPicker {
  private readonly transloco = inject(TranslocoService);

  readonly nodes = input.required<readonly TimelineNode[]>();
  /** The point shown: `0` the first appearance, `n` after the n-th reveal. */
  readonly point = model.required<number>();

  protected readonly points = computed<ReaderPoint[]>(() => {
    const language = this.transloco.activeLang();
    const translate = (key: string, params?: Record<string, string>) =>
      this.transloco.translate(key, params);
    return this.nodes().map((node) =>
      node.kind === 'firstAppearance'
        ? {
            chapter: node.chapter ? chapterNumberOf(node.chapter) : '?',
            label: translate('content.reveals.firstAppearance'),
          }
        : {
            chapter: node.reveal.chapter ? chapterNumberOf(node.reveal.chapter) : '?',
            label: revealTitleOf(translate, node.reveal, language),
          },
    );
  });

  protected readonly last = computed(() => this.points().length - 1);
  protected readonly current = computed(() => this.points()[this.point()]);

  protected go(point: number): void {
    this.point.set(Math.max(0, Math.min(this.last(), point)));
  }
}
