import type { TranslocoService } from '@jsverse/transloco';

/** The draft about to be discarded, as its confirmation names it. */
export interface DiscardedDraft {
  /** "Logia": how the content is called. */
  readonly name: string;
  readonly number: number;
  readonly author: string;
  /** An administrator discarding someone else's draft. */
  readonly override: boolean;
}

/**
 * What discarding a draft leaves behind: nothing, for a first version - the content goes with
 * it - or the version before it, which a draft, always the latest, has right below.
 */
export function versionLeftAfterDiscard(number: number): number | null {
  return number > 1 ? number - 1 : null;
}

/**
 * The confirmation, worded for what is left: the previous version, or nothing at all - and,
 * for an administrator discarding someone else's draft, naming whose it is. The same wherever
 * a draft is discarded: the editor, a dashboard row.
 */
export function discardConfirmation(transloco: TranslocoService, draft: DiscardedDraft) {
  const left = versionLeftAfterDiscard(draft.number);
  const key = (part: string) => `content.editor.discard.${part}${left === null ? 'Whole' : 'Back'}`;
  const note = draft.override
    ? transloco.translate('content.editor.discard.noteOverride', { author: draft.author })
    : transloco.translate('content.editor.discard.note');
  return {
    title: transloco.translate(key('title'), { name: draft.name }),
    body: transloco.translate(key('body'), { version: left }),
    note,
    confirmLabel: transloco.translate('content.editor.discard.confirm'),
  };
}

/** "Draft discarded: v2 remains", or "Draft removed" when the content went with it. */
export function discardDoneMessage(transloco: TranslocoService, number: number): string {
  const left = versionLeftAfterDiscard(number);
  return left === null
    ? transloco.translate('content.editor.discard.goneWhole')
    : transloco.translate('content.editor.discard.goneBack', { version: left });
}
