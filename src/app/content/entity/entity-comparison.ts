import { NgTemplateOutlet } from '@angular/common';
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
import { EntityImageFrame } from './entity-image-frame';
import { labelKeyOf, type EntityField, type ImageField } from './entity-definition';
import { imagePartOf } from './entity-gallery';
import { monthDayLabel } from './entity-month-day';
import {
  REVEALED_AT,
  REVEAL_TITLE,
  diffReveals,
  revealGroups,
  revealTitleOf,
  type RevealChange,
} from './entity-reveals';
import { comparedStoryPointLabel } from './entity-story-point';
import { untitledOf } from './entity-title';

/** The ratio (width / height) a frame has where the entity's image says nothing else. */
const DEFAULT_IMAGE_RATIO = 4 / 5;

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

/** A reveal added, removed or changed reads as a field would. */
const REVEAL_CHANGE: Record<RevealChange, FieldChange> = {
  ADDED: 'ADDED',
  REMOVED: 'REMOVED',
  MODIFIED: 'MODIFIED',
};

/** A field of the comparison, ready to render. */
interface DiffRow {
  readonly key: string;
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
  /** `before` and `after` are the URLs of two images, shown side by side, not texts. */
  readonly image: boolean;
  /** The ratio of the frames that show them: the image profile's own. */
  readonly ratio: number;
  readonly sign: string;
  /** A removed value is struck through. */
  readonly struck: boolean;
  readonly changeKey: string;
  readonly classes: (typeof CHANGE_CLASSES)[FieldChange];
}

/** A reveal of the comparison, ready to render: its heading, the choices it names, its rows. */
interface RevealCard {
  readonly key: string;
  readonly heading: string;
  readonly sign: string;
  readonly changeKey: string;
  readonly chip: string;
  /** "Name, Type" before and after, where the choices it names changed. */
  readonly named: { readonly before: string; readonly after: string } | null;
  readonly rows: readonly DiffRow[];
}

/** The reveals block: the initial values that changed, then the reveals that changed. */
interface RevealsBlock {
  readonly initial: readonly DiffRow[];
  readonly reveals: readonly RevealCard[];
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
  imports: [
    CloseButton,
    EntityCard,
    EntityImageFrame,
    LoadingPlaceholder,
    NgTemplateOutlet,
    TranslocoPipe,
    VersionChain,
  ],
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

  /**
   * The reveals compared (reveals decision 2): the initial knowledge as fields, the reveals by
   * their place in the reader's order. `null` for an entity without reveals.
   */
  protected readonly revealsBlock = computed<RevealsBlock | null>(() => {
    this.transloco.activeLang();
    const pair = this.pair();
    if (!this.entity.reveals || !pair) {
      return null;
    }
    const order = this.languages().map((language) => language.code);
    const compared = diffReveals(this.entity, pair.base?.body ?? null, pair.shown.body, order);
    const initialLabel = this.transloco.translate('content.comparison.reveals.initial');
    return {
      initial: compared.initial.map((diff) => this.revealRow(diff, initialLabel)),
      reveals: compared.reveals.map((diff) => {
        const heading = [
          this.transloco.translate('content.comparison.reveals.reveal', {
            position: diff.position,
          }),
          revealTitleOf(
            (key, params) => this.transloco.translate(key, params),
            diff.reveal,
            this.transloco.activeLang(),
          ),
        ].join(' · ');
        const change = REVEAL_CHANGE[diff.change];
        return {
          key: `${diff.position}.${diff.change}`,
          heading,
          sign: CHANGE_SIGN[change],
          changeKey: `content.comparison.change.${change}`,
          chip: CHANGE_CLASSES[change].chip,
          named: diff.named && {
            before: this.groupsNamed(diff.named.before),
            after: this.groupsNamed(diff.named.after),
          },
          rows: diff.rows.map((row) => this.revealRow(row, null)),
        };
      }),
    };
  });

  /** How many reveal entries changed - the initial knowledge counts as one. */
  protected readonly revealChanges = computed(() => {
    const block = this.revealsBlock();
    return block ? block.reveals.length + (block.initial.length ? 1 : 0) : 0;
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
        localizedName(namesOf(this.entity, shown.body), this.transloco.activeLang()) ??
        untitledOf(this.transloco, this.entity, shown.body) ??
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

  /** Where the words of a field live in the catalog: `paragraphs.description` for a section. */
  private labelKeyOf(key: string): string {
    const field = this.entity.fields.find((candidate) => candidate.key === key);
    return field ? labelKeyOf(field) : key;
  }

  /** The entity's image field named `key`, if it is one. */
  private imageField(key: string): ImageField | undefined {
    return this.entity.fields.find(
      (candidate): candidate is ImageField => candidate.key === key && candidate.kind === 'image',
    );
  }

  /** The image part of a list's entries named `part` - a gallery's image - if it is one. */
  private entryImagePart(key: string, part: string): ImageField | undefined {
    const list = this.entity.fields.find((candidate) => candidate.key === key);
    const image = list?.kind === 'partList' ? imagePartOf(list) : null;
    return image?.key === part ? image : undefined;
  }

  private toRow(diff: FieldDiff<EntityFieldRef>): DiffRow {
    const { field, language, entry } = diff.field;
    const image = entry ? this.entryImagePart(field, entry.part) : this.imageField(field);
    const storyPoint = entry
      ? entry.part === 'firstAppearance' || entry.storyPoint === true
      : this.entity.fields.some(
          (candidate) => candidate.key === field && candidate.kind === 'storyPoint',
        );
    return {
      key: entry
        ? `${field}.${entry.id}.${entry.subPosition ?? ''}.${entry.part}.${language ?? ''}`
        : `${field}.${language ?? ''}`,
      label: entry
        ? this.transloco.translate(
            `content.comparison.field.${this.labelKeyOf(field)}.${entry.part}`,
            {
              language: language?.toUpperCase(),
              subcategory:
                entry.name ??
                this.transloco.translate('content.comparison.field.unnamedEntry', {
                  position: entry.position,
                }),
              position: entry.position,
              subPosition: entry.subPosition,
            },
          )
        : this.transloco.translate(`content.comparison.field.${field}`, {
            language: language?.toUpperCase(),
          }),
      before: storyPoint
        ? this.storyPointNamed(diff.before)
        : this.valueNamed(field, diff.before, entry?.part),
      after: storyPoint
        ? this.storyPointNamed(diff.after)
        : this.valueNamed(field, diff.after, entry?.part),
      image: image !== undefined,
      ratio: image ? image.profile.width / image.profile.height : DEFAULT_IMAGE_RATIO,
      sign: CHANGE_SIGN[diff.change],
      struck: diff.change === 'REMOVED',
      changeKey: `content.comparison.change.${diff.change}`,
      classes: CHANGE_CLASSES[diff.change],
    };
  }

  /**
   * A value of a closed set, or a yes or no, in words, a day of the year as a date; any other
   * value as compared. `part` is the part of an entry of a list, whose kind says how it reads.
   */
  private valueNamed(key: string, compared: string | null, part?: string): string | null {
    const field = this.entity.fields.find((candidate) => candidate.key === key);
    // A part of a nested list is named `periods.marineRank`: the nested list, then its part.
    const [first, nested] = part?.split('.') ?? [];
    const owner = field?.kind === 'partList' ? field.parts.find(({ key }) => key === first) : null;
    const named: EntityField | undefined =
      field?.kind !== 'partList'
        ? field
        : owner?.kind === 'partList' && nested
          ? owner.parts.find(({ key }) => key === nested)
          : (owner ?? undefined);
    if (compared === null) {
      return null;
    }
    if (named?.kind === 'choice') {
      return this.transloco.translate(`${this.entity.i18n}.options.${named.key}.${compared}`);
    }
    if (named?.kind === 'monthDay') {
      return monthDayLabel(compared, this.transloco.activeLang());
    }
    const kind = named?.kind;
    if (kind === 'boolean') {
      return this.transloco.translate(compared === 'true' ? 'content.card.yes' : 'content.card.no');
    }
    return compared;
  }

  /** A first appearance compared, as every screen names it: "Cap. 1 — Romance Dawn". */
  private storyPointNamed(compared: string | null): string | null {
    return comparedStoryPointLabel(
      (key, params) => this.transloco.translate(key, params),
      compared,
    );
  }

  /**
   * A field of the reveals block as a row: the point, a title per language or a value - labelled
   * by `prefix` ("Initial knowledge · Name IT") where it has one.
   */
  private revealRow(diff: FieldDiff<EntityFieldRef>, prefix: string | null): DiffRow {
    const { field, language } = diff.field;
    const storyPoint = field === REVEALED_AT;
    const own =
      field === REVEALED_AT || field === REVEAL_TITLE
        ? this.transloco.translate(`content.comparison.reveals.${field}`)
        : this.transloco.translate(`content.reveals.value.${field}`);
    const label = [prefix, language ? `${own} ${language.toUpperCase()}` : own]
      .filter(Boolean)
      .join(' · ');
    return {
      key: `${prefix ?? ''}.${field}.${language ?? ''}`,
      label,
      before: storyPoint ? this.storyPointNamed(diff.before) : this.valueNamed(field, diff.before),
      after: storyPoint ? this.storyPointNamed(diff.after) : this.valueNamed(field, diff.after),
      image: false,
      ratio: DEFAULT_IMAGE_RATIO,
      sign: CHANGE_SIGN[diff.change],
      struck: diff.change === 'REMOVED',
      changeKey: `content.comparison.change.${diff.change}`,
      classes: CHANGE_CLASSES[diff.change],
    };
  }

  /** The choices a reveal names, in words and in the definition's order: "Name, Type". */
  private groupsNamed(groups: readonly string[]): string {
    return (
      revealGroups(this.entity)
        .filter((group) => groups.includes(group.key))
        .map((group) => this.transloco.translate(`content.reveals.field.${group.key}`))
        .join(', ') || '—'
    );
  }

  /** A user as the screen names them: "you" for the caller. */
  private who(username: string): string {
    return username === this.currentUser.me.value()?.username
      ? this.transloco.translate('content.list.you')
      : username;
  }
}
