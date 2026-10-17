import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService } from '../../shared/mascot/mascot';
import { entityOf } from './entities';
import type { EntityDefinition, EntityField } from './entity-definition';
import { isReference, referenceLabel, type EntityReference } from './entity-reference';
import {
  INITIAL_NODE,
  forwardTimeline,
  newReveal,
  revealableFields,
  withRevealedField,
  withReveal,
  withValue,
  type Belief,
  type RevealDraft,
  type RevealsDraft,
  type TimelineNode,
  type TimelineRow,
  chapterNumberOf,
  revealTitleOf,
} from './entity-reveals';
import { STORY_POINT_TARGET, chapterLabel } from './entity-story-point';
import { isSubcategoryReference, subcategoryChoices, subcategoryLabel } from './entity-subcategory';
import { kindOf, textOf } from './field-kinds';
import { RelationPicker } from './relation-picker';

/** Where a value is written when a reveal reaches the truth: the main fields. */
const TRUTH_NODE = 'truth';

/** One point of the list on the left. */
interface NodeView {
  readonly key: string;
  readonly kind: TimelineNode['kind'];
  readonly chapter: string | null;
  readonly label: string;
  readonly count: number;
  readonly refused: boolean;
}

/** One problem of the summary box: where it is, in words, and what is wrong. */
interface SummaryItem {
  readonly node: string;
  readonly text: string;
}

/**
 * The "Reveals" tab of a content (plan timeline, T11/T13): the timeline read forward on the
 * left - the first appearance as its start, not a reveal and so not opened, then each
 * reveal - and the reveal picked on the right. Written in the editor, read only on the card; the values are held and shown with
 * each field's kind, the reveals are worked out by `entity-reveals.ts`.
 */
@Component({
  selector: 'app-reveals-panel',
  imports: [NgTemplateOutlet, TranslocoPipe, RelationPicker],
  templateUrl: './reveals-panel.html',
})
export class RevealsPanel {
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);

  readonly entity = input.required<EntityDefinition>();
  readonly reveals = input.required<RevealsDraft>();
  /** The main fields: what the last reveal of a field reveals. */
  readonly truth = input.required<Belief>();
  readonly firstAppearance = input<unknown>(null);
  /** The languages of the catalog, in order. */
  readonly languages = input.required<readonly string[]>();
  readonly editable = input(false);
  /** What the backend refused at the last save, by node then target (`revealRefusalOf`). */
  readonly refusals = input<Readonly<Record<string, Readonly<Record<string, string>>>>>({});

  constructor() {
    // While the tab is open, the Lumacofono's tips are about reveals.
    this.mascot.tipTopic.set('reveals');
    inject(DestroyRef).onDestroy(() => this.mascot.tipTopic.set(null));
  }

  readonly changed = output<RevealsDraft>();
  /** The main fields as a reveal reaching the truth wrote them: what the reader learns. */
  readonly truthChanged = output<Belief>();

  protected readonly truthNode = TRUTH_NODE;
  protected readonly initialNode = INITIAL_NODE;

  protected readonly selected = signal<string | null>(null);

  /**
   * The field open in the reveal shown, one at a time; all closed when a reveal is opened.
   */
  private readonly openField = signal<string | null>(null);

  protected readonly chapterSource = entityOf(STORY_POINT_TARGET)?.api ?? null;
  protected readonly uiLanguage = computed(() => this.transloco.activeLang());

  /** The language the translated values are shown in: one at a time, the UI's to begin with. */
  protected readonly textLanguage = linkedSignal(() =>
    this.languages().includes(this.uiLanguage()) ? this.uiLanguage() : this.languages()[0],
  );

  protected readonly fields = computed(() => revealableFields(this.entity()));

  private readonly nodes = computed(() =>
    forwardTimeline(this.entity(), this.truth(), this.reveals(), this.firstAppearance()),
  );

  protected readonly nodeViews = computed<NodeView[]>(() =>
    this.nodes().map((node) => {
      const key = this.keyOf(node);
      switch (node.kind) {
        case 'firstAppearance':
          return {
            key,
            kind: node.kind,
            chapter: node.chapter ? chapterNumberOf(node.chapter) : null,
            label: this.transloco.translate('content.reveals.firstAppearance'),
            count: node.fields.length,
            refused: this.isRefused(key),
          };
        case 'reveal':
          return {
            key,
            kind: node.kind,
            chapter: node.reveal.chapter ? chapterNumberOf(node.reveal.chapter) : null,
            label: this.revealTitle(node.reveal),
            count: node.reveal.fields.length,
            refused: this.isRefused(key),
          };
      }
    }),
  );

  protected readonly current = computed(() => {
    const selected = this.selected();
    return this.nodes().find((node) => this.keyOf(node) === selected) ?? null;
  });

  /** Every problem refused at the last save, one line each, in timeline order. */
  protected readonly summary = computed<SummaryItem[]>(() =>
    this.nodeViews().flatMap((node) =>
      Object.entries(this.refusals()[node.key] ?? {}).map(([target, message]) => ({
        node: node.key,
        text: [this.nodeName(node), this.targetName(target), message].filter(Boolean).join(' · '),
      })),
    ),
  );

  protected select(key: string): void {
    this.selected.update((selected) => (selected === key ? null : key));
    this.openField.set(null);
  }

  /** The field open among the rows of the reveal shown. */
  protected openRow(rows: readonly TimelineRow[]): string | null {
    const open = this.openField();
    return rows.find(({ field }) => field === open)?.field ?? null;
  }

  protected toggleRow(rows: readonly TimelineRow[], field: string): void {
    this.openField.set(this.openRow(rows) === field ? null : field);
  }

  /** A long text: its two values shown one above the other. */
  protected isLong(field: EntityField): boolean {
    return 'rows' in field && (field.rows ?? 1) > 1;
  }

  protected keyOf(node: TimelineNode): string {
    switch (node.kind) {
      case 'firstAppearance':
        return INITIAL_NODE;
      case 'reveal':
        return node.reveal.key;
    }
  }

  protected refusalOf(node: string, target: string): string | null {
    return this.refusals()[node]?.[target] ?? null;
  }

  protected isRefused(node: string): boolean {
    return Object.keys(this.refusals()[node] ?? {}).length > 0;
  }

  protected chapterText(chapter: EntityReference | null): string {
    return chapter
      ? chapterLabel(
          (key, params) => this.transloco.translate(key, params),
          chapter,
          this.uiLanguage(),
        )
      : this.transloco.translate('content.reveals.noChapter');
  }

  protected readonly chapterPickLabel = (chapter: EntityReference, language: string) =>
    chapterLabel((key, params) => this.transloco.translate(key, params), chapter, language);

  /** Its title in the UI's language; while a draft lacks it, "Reveal at ch. N". */
  protected revealTitle(reveal: RevealDraft): string {
    return revealTitleOf(
      (key, params) => this.transloco.translate(key, params),
      reveal,
      this.uiLanguage(),
    );
  }

  private nodeName(node: NodeView): string {
    const chapter = node.chapter
      ? this.transloco.translate('content.reveals.chapterShort', { chapter: node.chapter })
      : null;
    return [chapter, node.label].filter(Boolean).join(' — ');
  }

  /** `chapter`, `title.it`, `it.description`, `type`… in words; nothing for the whole node. */
  private targetName(target: string): string {
    if (target === 'node') {
      return '';
    }
    const [first, second] = target.split('.');
    if (second === undefined) {
      return this.transloco.translate(`content.reveals.target.${first}`);
    }
    const what = first === 'title' ? 'title' : second;
    const language = (first === 'title' ? second : first).toUpperCase();
    return `${this.transloco.translate(`content.reveals.target.${what}`)} ${language}`;
  }

  protected fieldOf(key: string): EntityField | null {
    return this.entity().fields.find((field) => field.key === key) ?? null;
  }

  protected isLocalized(field: EntityField): boolean {
    return kindOf(field).localized;
  }

  /** The subcategory field that goes with a revealed relation, if any. */
  protected subcategoryOf(key: string): EntityField | null {
    return (
      this.entity().fields.find((field) => field.kind === 'subcategory' && field.of === key) ?? null
    );
  }

  /** A value of a belief in words - `null` where it is not known (not revealed yet). */
  protected valueText(belief: Belief, field: EntityField, language: string): string | null {
    if (kindOf(field).localized) {
      return textOf(belief.translations[language]?.[field.key]).trim() || null;
    }
    const value = belief[field.key];
    if (field.kind === 'relation') {
      if (!isReference(value)) {
        return null;
      }
      const subcategory = this.subcategoryOf(field.key);
      const picked = subcategory ? belief[subcategory.key] : null;
      const label = referenceLabel(value, language);
      return isSubcategoryReference(picked)
        ? `${label} · ${subcategoryLabel(picked, language)}`
        : label;
    }
    return textOf(value).trim() || null;
  }

  protected relationSource(field: EntityField): string | null {
    return field.kind === 'relation' ? (entityOf(field.target)?.api ?? null) : null;
  }

  protected subcategoryChoicesOf(belief: Belief, key: string) {
    return subcategoryChoices(belief[key]);
  }

  protected pickedSubcategory(belief: Belief, key: string): string {
    const subcategory = this.subcategoryOf(key);
    const picked = subcategory ? belief[subcategory.key] : null;
    return isSubcategoryReference(picked) ? picked.id : '';
  }

  protected textValue(belief: Belief, key: string, language: string | null): string {
    return textOf(language === null ? belief[key] : belief.translations[language]?.[key]);
  }

  /** The fields a reveal does not name yet, for "+ Add field". */
  protected freeFields(reveal: RevealDraft): EntityField[] {
    return this.fields().filter(({ key }) => !reveal.fields.includes(key));
  }

  /** Where a row's value known before comes from: the first appearance or an earlier reveal. */
  protected beforeSource(belief: Belief): string {
    const reveal = this.reveals().reveals.find(({ values }) => values === belief);
    return reveal?.chapter
      ? this.transloco.translate('content.reveals.fromReveal', {
          chapter: chapterNumberOf(reveal.chapter),
        })
      : this.transloco.translate('content.reveals.fromFirstAppearance');
  }

  // --- Editing: each change hands the whole reveals back to the editor, which holds them.

  protected addReveal(): void {
    const reveal = newReveal(this.languages());
    this.changed.emit({ ...this.reveals(), reveals: [...this.reveals().reveals, reveal] });
    this.selected.set(reveal.key);
  }

  protected removeReveal(key: string): void {
    this.changed.emit({
      ...this.reveals(),
      reveals: this.reveals().reveals.filter((reveal) => reveal.key !== key),
    });
    this.selected.set(null);
  }

  protected setChapter(key: string, chapter: EntityReference | null): void {
    this.changed.emit(withReveal(this.reveals(), key, (reveal) => ({ ...reveal, chapter })));
  }

  protected setTitle(key: string, language: string, title: string): void {
    this.changed.emit(
      withReveal(this.reveals(), key, (reveal) => ({
        ...reveal,
        titles: { ...reveal.titles, [language]: title },
      })),
    );
  }

  protected addField(key: string, field: string): void {
    if (!field) {
      return;
    }
    this.changed.emit(withRevealedField(this.entity(), this.reveals(), key, field, this.truth()));
    this.openField.set(field);
  }

  protected removeField(key: string, field: string): void {
    this.changed.emit(
      withReveal(this.reveals(), key, (reveal) => ({
        ...reveal,
        fields: reveal.fields.filter((named) => named !== field),
      })),
    );
  }

  /** A value of the initial knowledge (`node` is `initial`) or of a reveal. */
  protected setValue(node: string, key: string, language: string | null, value: unknown): void {
    this.write(node, (belief) => withValue(belief, key, language, value));
  }

  /** A relation picked: its subcategory is cleared, it belongs to the one picked before. */
  protected setRelation(node: string, key: string, reference: EntityReference | null): void {
    const subcategory = this.subcategoryOf(key);
    this.write(node, (belief) => {
      const picked = withValue(belief, key, null, reference);
      return subcategory ? withValue(picked, subcategory.key, null, null) : picked;
    });
  }

  protected setSubcategory(node: string, key: string, id: string): void {
    const subcategory = this.subcategoryOf(key);
    if (!subcategory) {
      return;
    }
    this.write(node, (belief) =>
      withValue(
        belief,
        subcategory.key,
        null,
        subcategoryChoices(belief[key]).find((choice) => choice.id === id) ?? null,
      ),
    );
  }

  /** A belief changed: the truth (`TRUTH_NODE`), the initial knowledge or a reveal's. */
  private write(node: string, change: (belief: Belief) => Belief): void {
    if (node === TRUTH_NODE) {
      this.truthChanged.emit(change(this.truth()));
      return;
    }
    if (node === INITIAL_NODE) {
      this.changed.emit({ ...this.reveals(), initial: change(this.reveals().initial) });
      return;
    }
    this.changed.emit(
      withReveal(this.reveals(), node, (reveal) => ({
        ...reveal,
        values: change(reveal.values),
      })),
    );
  }
}
