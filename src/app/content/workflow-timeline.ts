import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CurrentUserService } from '../identity/current-user';
import type { VersionEvent } from './content.model';
import { momentLabel } from './moment-label';
import { STATUS_SOFT_CLASS } from './status-badge';
import { CREATED_ACTION, REJECTED_ACTION, SUPERSEDED_ACTION, eventKind } from './version-event';

/** An action the screen has no name for: listed as recorded, in the tone of a draft. */
const UNKNOWN_GLYPH = '•';
const UNKNOWN_TONE_CLASSES = STATUS_SOFT_CLASS.DRAFT;

/** One step of the timeline, ready to render. */
interface StepView {
  readonly label: string;
  readonly glyph: string;
  readonly toneClasses: string;
  readonly who: string;
  readonly when: string;
  readonly reason: string | null;
}

/**
 * "Cronologia del workflow": who did what to a version and when, the most recent first -
 * every record the audit log holds about it, a claim as much as a change of status. A
 * rejection shows its reason.
 */
@Component({
  selector: 'app-workflow-timeline',
  templateUrl: './workflow-timeline.html',
  imports: [TranslocoPipe],
})
export class WorkflowTimeline {
  private readonly transloco = inject(TranslocoService);
  private readonly currentUser = inject(CurrentUserService);

  /** The history of the version, oldest first - as the API returns it. */
  readonly events = input.required<readonly VersionEvent[]>();
  /** The version this one was opened from: its creation says so. */
  readonly basedOn = input.required<number | null>();

  protected readonly steps = computed<StepView[]>(() => {
    this.transloco.activeLang();
    return this.events()
      .map((event) => this.toStepView(event))
      .reverse();
  });

  private toStepView(event: VersionEvent): StepView {
    const kind = eventKind(event.action);
    return {
      label: kind ? this.labelOf(event, kind.labelKey) : event.action,
      glyph: kind?.glyph ?? UNKNOWN_GLYPH,
      toneClasses: kind ? STATUS_SOFT_CLASS[kind.status] : UNKNOWN_TONE_CLASSES,
      who: this.who(event),
      when: momentLabel(this.transloco, event.occurredAt),
      reason: event.action === REJECTED_ACTION ? event.detail : null,
    };
  }

  /** The action in words - which version a new draft came from, which one took this one's place. */
  private labelOf(event: VersionEvent, labelKey: string): string {
    const basedOn = this.basedOn();
    if (event.action === CREATED_ACTION && basedOn !== null) {
      return this.transloco.translate('content.event.createdFrom', { version: basedOn });
    }
    if (event.action === SUPERSEDED_ACTION && event.detail) {
      return this.transloco.translate('content.event.supersededBy', { version: event.detail });
    }
    return this.transloco.translate(labelKey);
  }

  /** The actor by username - "You" for the caller, the e-mail for a record older than usernames. */
  private who(event: VersionEvent): string {
    const actor = event.actor;
    return actor.username === this.currentUser.me.value()?.username
      ? this.transloco.translate('content.list.you')
      : actor.username || actor.email;
  }
}
