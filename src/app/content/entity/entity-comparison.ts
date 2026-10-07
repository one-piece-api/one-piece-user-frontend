import { httpResource } from '@angular/common/http';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CurrentUserService } from '../../identity/current-user';
import { CloseButton } from '../../shared/ui/close-button';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import {
  STATUS_LABEL_KEY,
  localizedName,
  type Version,
  type VersionSummary,
} from '../content.model';
import type { LanguageEntry } from '../language-catalog';
import { momentLabel } from '../moment-label';
import { VersionChain } from '../version-chain';
import {
  FIELD_CHANGES,
  countChanges,
  defaultBase,
  earlierVersions,
  type FieldChange,
  type FieldDiff,
} from '../version-comparison';
import { EntityCard } from './entity-card';
import { diffBodies, namesOf, type EntityBody, type EntityFieldRef } from '../entity/entity-body';
import { ENTITY } from './entities';

type Mode = 'changes' | 'card';
const MODES: readonly Mode[] = ['changes', 'card'];

/** How each change is painted - literal class names, so Tailwind keeps them. */
const CHANGE_CLASSES: Record<
  FieldChange,
  { chip: string; before: string; after: string; beforeSign: string; afterSign: string }
> = {
  ADDED: {
    chip: 'bg-success-100 text-success-700',
    before: 'bg-parchment-200/50 text-ocean-500/40',
    after: 'bg-success-100 text-success-700',
    beforeSign: '',
    afterSign: '+',
  },
  REMOVED: {
    chip: 'bg-flag-100 text-flag-700',
    before: 'bg-flag-100 text-flag-700',
    after: 'bg-parchment-200/50 text-ocean-500/40',
    beforeSign: '−',
    afterSign: '',
  },
  MODIFIED: {
    chip: 'bg-treasure-100 text-treasure-700',
    before: 'bg-flag-100 text-flag-700',
    after: 'bg-treasure-100 text-treasure-700',
    beforeSign: '−',
    afterSign: '~',
  },
  UNCHANGED: {
    chip: 'bg-status-draft-soft text-status-draft-ink',
    before: '',
    after: '',
    beforeSign: '',
    afterSign: '',
  },
};

const CHANGE_SIGN: Record<FieldChange, string> = {
  ADDED: '+',
  REMOVED: '−',
  MODIFIED: '~',
  UNCHANGED: '=',
};

/** A field of the comparison, ready to render. */
interface DiffRow {
  readonly key: string;
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly sign: string;
  /** A removed value is struck through. */
  readonly struck: boolean;
  readonly changeKey: string;
  readonly classes: (typeof CHANGE_CLASSES)[FieldChange];
}

/**
 * The comparison of a version of any entity with an earlier one (UF-CNT-21), in a
 * native `<dialog>` like the other modals. By default the base is the version it was opened
 * from, the first version is compared with an empty content; the reader may pick another
 * earlier version, move along the chain, or see the version's whole card. Read-only: it
 * changes nothing, and its state does not go in the URL.
 */
@Component({
  selector: 'app-entity-comparison',
  templateUrl: './entity-comparison.html',
  imports: [CloseButton, EntityCard, LoadingPlaceholder, TranslocoPipe, VersionChain],
})
export class EntityComparison {
  private readonly entity = inject(ENTITY);
  private readonly transloco = inject(TranslocoService);
  private readonly currentUser = inject(CurrentUserService);

  /** Where the versions of the content are read from: `…/{section}/{id}/versions`. */
  readonly versionsUrl = input.required<string>();
  /** The chain the caller may see, oldest first. */
  readonly versions = input.required<readonly VersionSummary[]>();
  readonly onlineVersionNumber = input.required<number | null>();
  readonly languages = input.required<readonly LanguageEntry[]>();
  /** The version to compare when the panel opens; `null` keeps it closed. */
  readonly target = input.required<number | null>();

  readonly closed = output<void>();

  /** The version compared: the one asked for, until the reader moves along the chain. */
  protected readonly shownNumber = linkedSignal(() => this.target());
  /** What it is compared with - `null` for an empty content - back to the default on a move. */
  protected readonly baseNumber = linkedSignal(() => {
    const shown = this.shownNumber();
    return shown === null ? null : defaultBase(this.versions(), shown);
  });
  protected readonly modes = MODES;
  /** "Changes" or "full card": kept along the chain, back to the changes at every opening. */
  protected readonly mode = linkedSignal<number | null, Mode>({
    source: this.target,
    computation: () => 'changes',
  });
  /** Whether the unchanged fields are listed too: collapsed again on a move. */
  protected readonly showUnchanged = linkedSignal({
    source: this.shownNumber,
    computation: () => false,
  });

  private readonly shownVersion = httpResource<Version<EntityBody>>(() => {
    const shown = this.shownNumber();
    return shown === null ? undefined : `${this.versionsUrl()}/${shown}`;
  });
  private readonly baseVersion = httpResource<Version<EntityBody>>(() => {
    const base = this.baseNumber();
    return base === null ? undefined : `${this.versionsUrl()}/${base}`;
  });

  /** Both sides, once loaded - and only when they are the ones asked for. */
  private readonly pair = computed(() => {
    const shown = this.shownVersion.hasValue() ? this.shownVersion.value() : undefined;
    if (shown?.number !== this.shownNumber()) {
      return undefined;
    }
    const baseNumber = this.baseNumber();
    if (baseNumber === null) {
      return { base: null, shown };
    }
    const base = this.baseVersion.hasValue() ? this.baseVersion.value() : undefined;
    return base?.number === baseNumber ? { base, shown } : undefined;
  });

  protected readonly state = computed<'loading' | 'error' | 'ready'>(() => {
    if (this.shownVersion.error() || this.baseVersion.error()) {
      return 'error';
    }
    return this.pair() ? 'ready' : 'loading';
  });

  private readonly diffs = computed<FieldDiff<EntityFieldRef>[]>(() => {
    const pair = this.pair();
    const order = this.languages().map((language) => language.code);
    return pair ? diffBodies(this.entity, pair.base?.body ?? null, pair.shown.body, order) : [];
  });

  protected readonly changedRows = computed(() => {
    this.transloco.activeLang();
    return this.diffs()
      .filter((diff) => diff.change !== 'UNCHANGED')
      .map((diff) => this.toRow(diff));
  });
  protected readonly unchangedRows = computed(() => {
    this.transloco.activeLang();
    return this.diffs()
      .filter((diff) => diff.change === 'UNCHANGED')
      .map((diff) => this.toRow(diff));
  });

  /** "Show 3 unchanged fields", or "Hide…" once they are listed. */
  protected readonly unchangedToggleKey = computed(() => {
    const verb = this.showUnchanged() ? 'hideUnchanged' : 'showUnchanged';
    return `content.comparison.${verb}.${this.unchangedRows().length === 1 ? 'one' : 'many'}`;
  });

  /** "+ 2 added", "− 0 removed"…: every kind, zero included, as in the mockup. */
  protected readonly summary = computed(() => {
    const counts = countChanges(this.diffs());
    return FIELD_CHANGES.map((change) => ({
      change,
      sign: CHANGE_SIGN[change],
      count: counts[change],
      chipClasses: CHANGE_CLASSES[change].chip,
    }));
  });

  /** The earlier versions the reader may compare with, the most recent first. */
  protected readonly baseOptions = computed(() => {
    this.transloco.activeLang();
    const shown = this.shownNumber();
    return shown === null
      ? []
      : earlierVersions(this.versions(), shown).map((version) => ({
          number: version.number,
          label: [
            `v${version.number}`,
            this.transloco.translate(STATUS_LABEL_KEY[version.status]),
            momentLabel(this.transloco, version.createdAt),
          ].join(' · '),
        }));
  });

  /** The header: "Version 3 · Published", the name, "Comparing v1 → v3 · opened … by nami". */
  protected readonly heading = computed(() => {
    this.transloco.activeLang();
    const shown = this.pair()?.shown;
    if (!shown) {
      return null;
    }
    const status = this.transloco.translate(STATUS_LABEL_KEY[shown.status]);
    const base = this.baseNumber();
    const comparing =
      base === null
        ? this.transloco.translate('content.comparison.firstVersion')
        : this.transloco.translate('content.comparison.comparing', {
            base,
            version: shown.number,
          });
    const opened = this.transloco.translate('content.comparison.opened', {
      when: momentLabel(this.transloco, shown.createdAt),
      author: this.who(shown.author.username),
    });
    return {
      kicker: this.transloco.translate('content.comparison.kicker', {
        version: shown.number,
        status,
      }),
      title:
        localizedName(namesOf(shown.body), this.transloco.activeLang()) ??
        shown.body.romaji ??
        this.transloco.translate('content.list.unnamed'),
      line: `${comparing} · ${opened}`,
      after: `v${shown.number}`,
      afterLine: [
        status,
        momentLabel(this.transloco, shown.createdAt),
        this.who(shown.author.username),
      ].join(' · '),
    };
  });

  /** The version's whole card, in the "full card" mode. */
  protected readonly shownBody = computed(() => this.pair()?.shown.body ?? null);

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      const open = this.target() !== null;
      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    });
  }

  protected show(number: number): void {
    this.shownNumber.set(number);
  }

  protected pickBase(value: string): void {
    this.baseNumber.set(Number(value));
  }

  /** ESC, the backdrop and the × all close the dialog: the page then forgets the comparison. */
  protected onClose(): void {
    if (this.target() !== null) {
      this.closed.emit();
    }
  }

  protected onBackdropClick(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) {
      dialog.close();
    }
  }

  private toRow(diff: FieldDiff<EntityFieldRef>): DiffRow {
    const { field, language } = diff.field;
    return {
      key: `${field}.${language ?? ''}`,
      label: this.transloco.translate(`content.comparison.field.${field}`, {
        language: language?.toUpperCase(),
      }),
      before: diff.before,
      after: diff.after,
      sign: CHANGE_SIGN[diff.change],
      struck: diff.change === 'REMOVED',
      changeKey: `content.comparison.change.${diff.change}`,
      classes: CHANGE_CLASSES[diff.change],
    };
  }

  /** A user as the screen names them: "you" for the caller. */
  private who(username: string): string {
    return username === this.currentUser.me.value()?.username
      ? this.transloco.translate('content.list.you')
      : username;
  }
}
