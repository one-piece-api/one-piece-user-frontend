import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { MascotService } from '../shared/mascot/mascot';
import { ConfirmDialog } from '../shared/ui/confirm-dialog';
import type { VersionAction, VersionSummary } from './content.model';
import { draftFieldKey } from './devil-fruit-types/devil-fruit-type.model';
import { RejectDialog } from './reject-dialog';
import {
  NEW_VERSION,
  VERSION_TRANSITIONS,
  confirmsOverride,
  newVersionDoneKey,
  overriddenUser,
  transitionRefusal,
  type TransitionRefusal,
  type VersionTransition,
} from './version-transition';

/** What an action is run on: one version of one content, wherever it is shown. */
export interface ActionTarget {
  /** The content in the API, e.g. `/api/content/devil-fruit-types/{id}`. */
  readonly contentUrl: string;
  /** The content's detail screen in the app, e.g. `/content/devil-fruit-types/{id}`. */
  readonly contentRoute: string;
  /** "Logia": how the content is called, in the dialogs and the mascot's words. */
  readonly name: string;
  /** "Devil Fruit Type": its kind, already translated. */
  readonly entityLabel: string;
  readonly version: Pick<
    VersionSummary,
    'number' | 'status' | 'author' | 'claimant' | 'overrideActions'
  >;
  /** The version online now - the one a publication or a restore would replace. */
  readonly onlineVersionNumber: number | null;
}

/**
 * Runs the workflow actions on a version, wherever it is shown - its detail screen, a
 * dashboard status page - so both behave the same: a confirmation naming whose work it
 * is when an administrator acts on someone else's, the reason of a rejection, the
 * confirmation of a publication or an archiving, the editor for an edit or a new
 * version, then the mascot's word on how it went. Its host gives `reload` to read what
 * it shows again once an action is answered, whatever the outcome: a refusal often means
 * the version moved meanwhile.
 */
@Component({
  selector: 'app-version-actions',
  templateUrl: './version-actions.html',
  imports: [ConfirmDialog, RejectDialog],
})
export class VersionActions {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);

  /** Reads again what the host shows; awaited before the actions are offered again. */
  readonly reload = input.required<() => Promise<void>>();

  /** An action posted and not answered yet: the host's buttons wait for it. */
  readonly acting = signal(false);

  /** The version acted on while a dialog is open. */
  private readonly target = signal<ActionTarget | null>(null);
  /** An action on someone else's version or claim, waiting for the administrator to confirm it. */
  protected readonly overriding = signal<VersionAction | null>(null);
  /** The transition waiting for the reason the caller is writing - a rejection. */
  protected readonly askingReasonFor = signal<VersionTransition | null>(null);
  /** The transition waiting for the caller to confirm it - a publication, an archiving. */
  protected readonly confirming = signal<VersionTransition | null>(null);

  /** "Act in nami's place?": what the override dialog says, naming whose work it is. */
  protected readonly overrideConfirmation = computed(() => {
    this.transloco.activeLang();
    const action = this.overriding();
    const target = this.target();
    if (!action || !target) {
      return null;
    }
    const params = {
      owner: overriddenUser(action, target.version),
      version: target.version.number,
    };
    const key = (part: string) =>
      this.transloco.translate(`content.workflow.override.${part}`, params);
    return {
      title: key('title'),
      body: key(`body.${action}`),
      note: key('note'),
      confirmLabel: key('confirm'),
    };
  });

  /**
   * "Publish "Logia"?": what the confirm dialog says about the transition waiting for it,
   * naming the version that moves and, when it goes online in place of another, that one.
   */
  protected readonly confirmation = computed(() => {
    this.transloco.activeLang();
    const transition = this.confirming();
    const key = transition?.confirmKey;
    const target = this.target();
    if (!key || !target) {
      return null;
    }
    const online = replacedVersion(transition, target);
    const params = { name: target.name, version: target.version.number, online };
    return {
      title: this.transloco.translate(`${key}.title`, params),
      body: this.transloco.translate(
        `${key}.${online !== null ? 'bodyReplacing' : 'body'}`,
        params,
      ),
      note: this.transloco.translate(`${key}.note`),
      confirmLabel: this.transloco.translate(`${key}.confirm`),
      tone: transition.confirmTone ?? 'primary',
    };
  });

  /** "Logia · Devil Fruit Type by nami": what the reject dialog is about. */
  protected readonly rejectTarget = computed(() => {
    this.transloco.activeLang();
    const target = this.target();
    if (!target) {
      return '';
    }
    const by = this.transloco.translate('content.detail.by', {
      author: target.version.author.username,
    });
    return `${target.name} · ${target.entityLabel} ${by}`;
  });

  /**
   * Acts on the version - after a confirmation naming whose work it is, when the caller
   * acts on someone else's version or claim as an administrator.
   */
  run(target: ActionTarget, action: VersionAction): void {
    this.target.set(target);
    if (confirmsOverride(action, target.version.overrideActions)) {
      this.overriding.set(action);
    } else {
      this.proceed(target, action);
    }
  }

  /** The administrator confirmed: the action goes on as for anyone else. */
  protected confirmOverride(): void {
    const action = this.overriding();
    const target = this.target();
    this.overriding.set(null);
    if (action && target) {
      this.proceed(target, action);
    }
  }

  /** Confirmed: the transition goes, and the dialog closes once it is answered. */
  protected confirm(): void {
    const transition = this.confirming();
    const target = this.target();
    if (transition && target) {
      void this.runTransition(target, transition, null).then(() => this.confirming.set(null));
    }
  }

  /** The reason is written: the rejection goes, and the dialog closes once it is answered. */
  protected rejectWith(reason: string): void {
    const transition = this.askingReasonFor();
    const target = this.target();
    if (transition && target) {
      void this.runTransition(target, transition, { reason }).then(() =>
        this.askingReasonFor.set(null),
      );
    }
  }

  /**
   * Reopens the version in the editor, opens a new version from it, asks the reason of a
   * rejection or a confirmation first, or runs a transition on it.
   */
  private proceed(target: ActionTarget, action: VersionAction): void {
    if (action === 'EDIT') {
      this.openEditor(target);
      return;
    }
    if (action === NEW_VERSION.action) {
      void this.openNewVersion(target);
      return;
    }
    const transition = VERSION_TRANSITIONS[action];
    if (transition?.asksReason) {
      this.askingReasonFor.set(transition);
    } else if (transition?.confirmKey) {
      this.confirming.set(transition);
    } else if (transition) {
      void this.runTransition(target, transition, null);
    }
  }

  /** Posts the transition, says how it went, and has the host read again what it shows. */
  private async runTransition(
    target: ActionTarget,
    transition: VersionTransition,
    body: object | null,
  ): Promise<void> {
    const { version } = target;
    const online = replacedVersion(transition, target);
    const doneKey = (online !== null && transition.doneReplacingKey) || transition.doneKey;
    this.acting.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${target.contentUrl}/versions/${version.number}/${transition.path}`, body),
      );
      this.mascot.show(
        this.transloco.translate(doneKey, {
          author: version.author.username,
          version: version.number,
          online,
        }),
        transition.doneTone ?? 'success',
      );
    } catch (error) {
      this.mascot.show(this.refusalMessage(transitionRefusal(error)), 'error');
    } finally {
      await this.reload()();
      this.acting.set(false);
    }
  }

  /**
   * Opens the next version of the content from this one, then the editor on it - no
   * confirmation, as in the mockup: nothing online changes, and the new draft can be
   * discarded. A refusal - someone opened one first - shows the content as it now is.
   */
  private async openNewVersion(target: ActionTarget): Promise<void> {
    const base = target.version;
    const online = target.onlineVersionNumber;
    this.acting.set(true);
    try {
      const opened = await firstValueFrom(
        this.http.post<{ number: number }>(`${target.contentUrl}/versions`, {
          basedOn: base.number,
        }),
      );
      this.mascot.show(
        this.transloco.translate(newVersionDoneKey(base.status, online), {
          version: opened.number,
          base: base.number,
          online,
        }),
        'info',
      );
      this.openEditor(target);
    } catch (error) {
      this.mascot.show(this.refusalMessage(transitionRefusal(error)), 'error');
      await this.reload()();
    } finally {
      this.acting.set(false);
    }
  }

  /** The editor of the content's draft - the caller's own, the one they may edit. */
  private openEditor(target: ActionTarget): void {
    void this.router.navigateByUrl(`${target.contentRoute}/edit`);
  }

  private refusalMessage(refusal: TransitionRefusal): string {
    const key = (name: string) => `content.workflow.refused.${name}`;
    switch (refusal.kind) {
      case 'incomplete':
      case 'taken':
        return this.transloco.translate(key(refusal.kind), {
          fields: refusal.fields.map((field) => this.fieldLabel(field)).join(', '),
        });
      case 'identical':
        return this.transloco.translate(key('identical'), { version: refusal.version });
      case 'stale':
      case 'failed':
        return this.transloco.translate(key(refusal.kind));
    }
  }

  /** "romaji", "nome EN": a field named as the backend names it, in words. */
  private fieldLabel(field: string): string {
    const [language, name] = (draftFieldKey(field) ?? field).split('.');
    return name
      ? this.transloco.translate(`content.workflow.refused.field.${name}`, {
          language: language.toUpperCase(),
        })
      : this.transloco.translate('content.workflow.refused.field.romaji');
  }
}

/**
 * The version online now that the transition takes offline by putting another one online
 * in its place - published or restored - `null` when it does not.
 */
function replacedVersion(transition: VersionTransition, target: ActionTarget): number | null {
  const online = target.onlineVersionNumber;
  return transition.target === 'PUBLISHED' && online !== null && online !== target.version.number
    ? online
    : null;
}
