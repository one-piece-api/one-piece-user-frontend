import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CurrentUserService } from '../identity/current-user';
import { ACTION_LABEL_KEY, type Version } from './content.model';
import { versionAccess, type AccessRow } from './version-access';

/** Granted, refused, and "you can move it forward" - a fill, an ink and a mark each. */
const GRANTED = { classes: 'bg-success-100 text-success-700', mark: '✓' };
const REFUSED = { classes: 'bg-status-draft-soft text-status-draft-ink', mark: '✕' };
const WORKFLOW = { classes: 'bg-treasure-100 text-treasure-700', mark: '→' };

/** One line of the panel, ready to render. */
interface RowView {
  readonly kind: AccessRow['kind'];
  readonly classes: string;
  readonly mark: string;
  readonly label: string;
  readonly note: string | null;
}

/**
 * "I tuoi permessi qui": what the caller may do with the version on screen, in three
 * lines - seeing it, editing it, moving it forward - each with the reason in words.
 */
@Component({
  selector: 'app-access-panel',
  templateUrl: './access-panel.html',
  imports: [TranslocoPipe],
})
export class AccessPanel {
  private readonly transloco = inject(TranslocoService);
  private readonly currentUser = inject(CurrentUserService);

  readonly version = input.required<Version<unknown>>();

  protected readonly rows = computed<RowView[]>(() => {
    this.transloco.activeLang();
    const me = this.currentUser.me.value();
    const caller = { username: me?.username, permissions: me?.permissions ?? [] };
    return versionAccess(this.version(), caller).map((row) => this.toRowView(row));
  });

  private toRowView(row: AccessRow): RowView {
    const tone = this.toneOf(row);
    return {
      kind: row.kind,
      classes: tone.classes,
      mark: tone.mark,
      label: this.labelOf(row),
      note: row.noteKey ? this.transloco.translate(row.noteKey, row.noteParams) : null,
    };
  }

  private toneOf(row: AccessRow) {
    if (!row.granted) {
      return REFUSED;
    }
    return row.kind === 'workflow' ? WORKFLOW : GRANTED;
  }

  private labelOf(row: AccessRow): string {
    const key = (name: string) => `content.workflow.access.${name}`;
    switch (row.kind) {
      case 'visible':
        return this.transloco.translate(key('visible'));
      case 'editable':
        return this.transloco.translate(key(row.granted ? 'editable' : 'notEditable'));
      case 'workflow':
        return row.granted
          ? this.transloco.translate(key('workflow'), { actions: this.actionsOf(row) })
          : this.transloco.translate(key('noWorkflow'));
    }
  }

  /** "submit for review · discard draft": the allowed actions, as one lower-case line. */
  private actionsOf(row: AccessRow): string {
    const version = this.version().number;
    return row.actions
      .map((action) => this.transloco.translate(ACTION_LABEL_KEY[action], { version }))
      .map((label) => label.toLocaleLowerCase(this.transloco.getActiveLang()))
      .join(' · ');
  }
}
