import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { blockWords, type BlockLink } from './block-words';
import { actionLabelKey, type Version } from './content.model';

/** One refusal, ready to render: the action, why, and the contents that stand in the way. */
interface NoticeView {
  readonly action: string;
  readonly actionLabel: string;
  readonly sentence: string;
  readonly links: readonly BlockLink[];
  /** "and 3 more": empty when every content in the way is named. */
  readonly andMore: string;
}

/**
 * What the caller could do with a version if the content allowed it, and why it does not:
 * one line per action in `blockedActions`, the reason in words and, where other contents
 * stand in the way, a link to each. The route shows the same refusal on the status itself;
 * here the words fit, and a touch screen, which has no tooltip, can read them.
 */
@Component({
  selector: 'app-blocked-notice',
  templateUrl: './blocked-notice.html',
  imports: [RouterLink, TranslocoPipe],
})
export class BlockedNotice {
  private readonly transloco = inject(TranslocoService);

  readonly version = input.required<Version<unknown>>();

  protected readonly items = computed<NoticeView[]>(() => {
    this.transloco.activeLang();
    const { blockedActions, status, number } = this.version();
    return blockedActions.map((blocked) => {
      const words = blockWords(this.transloco, blocked);
      return {
        action: blocked.action,
        actionLabel: this.transloco.translate(actionLabelKey(blocked.action, status), {
          version: number,
        }),
        sentence: words.sentence,
        links: words.links,
        andMore:
          words.more > 0
            ? this.transloco.translate('content.workflow.blocked.andMore', { count: words.more })
            : '',
      };
    });
  });
}
