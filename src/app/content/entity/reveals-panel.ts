import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { entityOf } from './entities';
import type { EntityDefinition, EntityField } from './entity-definition';
import { referenceLabel, isReference, type EntityReference } from './entity-reference';
import {
  INITIAL_NODE,
  TRUTH_NODE,
  forwardTimeline,
  groupFields,
  newReveal,
  revealGroups,
  revealTitleOf,
  withBelief,
  withRevealedGroup,
  withReveal,
  withValue,
  withoutGroup,
  type Belief,
  type RevealDraft,
  type RevealsDraft,
  type TimelineNode,
  type TimelineRow,
} from './entity-reveals';
import {
  STORY_POINT_PARTS,
  STORY_POINT_TARGETS,
  storyItemLabel,
  storyPointShortLabel,
  type StoryPointDraft,
  type StoryPointPart,
} from './entity-story-point';
import { isSubcategoryReference, subcategoryChoices, subcategoryLabel } from './entity-subcategory';
import { FIELD_KINDS, textOf } from './field-kinds';
import { RelationPicker } from './relation-picker';
import type { StoryAxes } from './part-list-editor';

/** One point of the list on the left. */
interface NodeView {
  readonly key: string;
  readonly kind: TimelineNode['kind'];
  readonly point: string | null;
  readonly label: string;
  readonly count: number;
  readonly refused: boolean;
}

/** One problem of the summary box: where it is, in words, and what is wrong. */
interface SummaryItem {
  readonly node: string;
  readonly text: string;
}

/** One picker of a reveal's point: its chapter or its episode, guarded by the first appearance. */
interface AxisPicker {
  readonly axis: StoryPointPart;
  readonly id: string;
  readonly source: string;
  readonly value: EntityReference | null;
  readonly disabled: boolean;
  readonly offAxis: boolean;
}

/**
 * The "Reveals" tab of a content (workflow 3.7.1, reveals plan R8, reveals decision 3): the
 * timeline read forward on the left - the first appearance with the initial knowledge, then each
 * reveal - and the point picked on the right, each choice as "before → after". Written in the
 * editor, read only on the detail; the values are held and shown with each field's kind, the
 * reveals are worked out by `entity-reveals.ts`. Ported from the `timeline` branch: a point on
 * both axes, choices of several fields (a Character's identity), one language at a time.
 */
@Component({
  selector: 'app-reveals-panel',
  imports: [NgTemplateOutlet, TranslocoPipe, RelationPicker],
  templateUrl: './reveals-panel.html',
})
export class RevealsPanel {
  private readonly transloco = inject(TranslocoService);

  readonly entity = input.required<EntityDefinition>();
  readonly reveals = input.required<RevealsDraft>();
  /** The main fields: what the last reveal of a choice reveals. */
  readonly truth = input.required<Belief>();
  readonly firstAppearance = input<unknown>(null);
  /** The languages of the catalog, in order. */
  readonly languages = input.required<readonly string[]>();
  /** The language shown first: the editor's tab, else the interface's. */
  readonly defaultLanguage = input<string | null>(null);
  /** The axes of the first appearance: a reveal's point follows them, as a window does. */
  readonly axes = input<StoryAxes>({ chapter: true, episode: true });
  readonly editable = input(false);
  /** What the backend refused at the last save, by node then target (`revealRefusalOf`). */
  readonly refusals = input<Readonly<Record<string, Readonly<Record<string, string>>>>>({});

  readonly changed = output<RevealsDraft>();
  /** The main fields as a reveal's last mention wrote them: the current value. */
  readonly truthChanged = output<Belief>();

  protected readonly initialNode = INITIAL_NODE;

  /**
   * The reveals as last handed back. Each edit builds on them, not on the input: the editor
   * passes the new reveals in only at the next change detection, and two quick edits - a value
   * typed, then a field added - would otherwise lose the first.
   */
  private readonly latest = linkedSignal(() => this.reveals());

  protected readonly selected = signal<string | null>(null);

  /** The choice open in the point shown, one at a time; all closed when a point is opened. */
  private readonly openGroup = signal<string | null>(null);

  protected readonly uiLanguage = computed(() => this.transloco.activeLang());

  /** The language the translated values and titles are shown in: one at a time. */
  protected readonly textLanguage = linkedSignal(() => {
    const preferred = this.defaultLanguage() ?? this.uiLanguage();
    return this.languages().includes(preferred) ? preferred : (this.languages()[0] ?? preferred);
  });

  protected readonly groups = computed(() => revealGroups(this.entity()));

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
            point: this.pointShort(node.point),
            label: this.transloco.translate('content.reveals.firstAppearance'),
            count: node.groups.length,
            refused: this.isRefused(key),
          };
        case 'reveal':
          return {
            key,
            kind: node.kind,
            point: this.pointShort(node.reveal.point),
            label: this.revealTitle(node.reveal),
            count: node.reveal.groups.length,
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

  /** The chapter and episode pickers the app can offer. */
  private readonly axisSources = STORY_POINT_PARTS.map((axis) => ({
    axis,
    source: entityOf(STORY_POINT_TARGETS[axis])?.api ?? null,
  })).filter((entry): entry is { axis: StoryPointPart; source: string } => entry.source !== null);

  protected readonly axisLabelOf = Object.fromEntries(
    STORY_POINT_PARTS.map((axis) => [
      axis,
      (item: EntityReference, language: string): string =>
        storyItemLabel(
          (key, params) => this.transloco.translate(key, params),
          axis,
          item,
          language,
        ),
    ]),
  ) as Record<StoryPointPart, (item: EntityReference, language: string) => string>;

  /** A reveal's point pickers, guarded by the axes of the first appearance (as a window's). */
  protected pickersOf(reveal: RevealDraft): AxisPicker[] {
    const axes = this.axes();
    return this.axisSources.map(({ axis, source }) => {
      const value = reveal.point[axis];
      return {
        axis,
        id: `reveal-${reveal.key}-${axis}`,
        source,
        value,
        disabled: !axes[axis] && value === null,
        offAxis: !axes[axis] && value !== null,
      };
    });
  }

  protected select(key: string): void {
    this.selected.update((selected) => (selected === key ? null : key));
    this.openGroup.set(null);
  }

  /** The choice open among the rows of the point shown. */
  protected openRow(rows: readonly TimelineRow[]): string | null {
    const open = this.openGroup();
    return rows.find(({ group }) => group === open)?.group ?? null;
  }

  protected toggleRow(rows: readonly TimelineRow[], group: string): void {
    this.openGroup.set(this.openRow(rows) === group ? null : group);
  }

  protected keyOf(node: TimelineNode): string {
    return node.kind === 'firstAppearance' ? INITIAL_NODE : node.reveal.key;
  }

  protected refusalOf(node: string, target: string): string | null {
    return this.refusals()[node]?.[target] ?? null;
  }

  protected isRefused(node: string): boolean {
    return Object.keys(this.refusals()[node] ?? {}).length > 0;
  }

  /** Whether some value of the language is refused, for the mark on its switch. */
  protected isLanguageRefused(language: string): boolean {
    return Object.values(this.refusals()).some((targets) =>
      Object.keys(targets).some((target) => target.split('.').includes(language)),
    );
  }

  /** "Cap. 23 · Ep. 9", `null` for a point not chosen yet. */
  private pointShort(point: StoryPointDraft): string | null {
    return storyPointShortLabel((key, params) => this.transloco.translate(key, params), point);
  }

  protected pointText(point: StoryPointDraft): string {
    return this.pointShort(point) ?? this.transloco.translate('content.reveals.noPoint');
  }

  /** Its title in the language shown; while a draft lacks it, "Reveal at ch. 100". */
  protected revealTitle(reveal: RevealDraft): string {
    return revealTitleOf(
      (key, params) => this.transloco.translate(key, params),
      reveal,
      this.textLanguage(),
    );
  }

  private nodeName(node: NodeView): string {
    return [node.point, node.label].filter(Boolean).join(' — ');
  }

  /** `point`, `title.it`, `it.name`, `type`... in words; nothing for the whole node. */
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

  protected fieldsOf(group: string): EntityField[] {
    return groupFields(this.entity(), group).filter((field) => field.kind !== 'subcategory');
  }

  protected isLocalized(field: EntityField): boolean {
    return FIELD_KINDS[field.kind].localized;
  }

  /** The subcategory field that goes with a revealed relation, if any. */
  protected subcategoryOf(key: string): EntityField | null {
    return (
      this.entity().fields.find((field) => field.kind === 'subcategory' && field.of === key) ?? null
    );
  }

  /** A value of a belief in words - `null` where it is not known (not revealed yet). */
  protected valueText(belief: Belief, field: EntityField, language: string): string | null {
    if (this.isLocalized(field)) {
      return textOf(belief.translations[language]?.[field.key]).trim() || null;
    }
    const value = belief[field.key];
    switch (field.kind) {
      case 'relation': {
        if (!isReference(value)) {
          return null;
        }
        const subcategory = this.subcategoryOf(field.key);
        const picked = subcategory ? belief[subcategory.key] : null;
        const label = referenceLabel(value, this.uiLanguage());
        return isSubcategoryReference(picked)
          ? `${label} · ${subcategoryLabel(picked, this.uiLanguage())}`
          : label;
      }
      case 'choice':
        return textOf(value)
          ? this.transloco.translate(`${this.entity().i18n}.options.${field.key}.${textOf(value)}`)
          : null;
      case 'boolean':
        return typeof value === 'boolean'
          ? this.transloco.translate(value ? 'content.reveals.yes' : 'content.reveals.no')
          : null;
      default:
        return textOf(value).trim() || null;
    }
  }

  /** A choice in words on its collapsed row: its fields' values, " · " between them. */
  protected groupText(belief: Belief, group: string): string | null {
    const texts = this.fieldsOf(group)
      .map((field) => this.valueText(belief, field, this.textLanguage()))
      .filter((text): text is string => text !== null);
    return texts.length ? texts.join(' · ') : null;
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

  protected optionsOf(field: EntityField): readonly string[] {
    return field.kind === 'choice' ? field.options : [];
  }

  protected maxLengthOf(field: EntityField): number | null {
    return 'maxLength' in field ? field.maxLength : null;
  }

  /** The choices a reveal does not name yet, for "+ Add". */
  protected freeGroups(reveal: RevealDraft): string[] {
    return this.groups()
      .map(({ key }) => key)
      .filter((key) => !reveal.groups.includes(key));
  }

  /** Where a row's value known before comes from: the first appearance or an earlier reveal. */
  protected beforeSource(row: TimelineRow): string {
    const reveal = this.reveals().reveals.find(({ key }) => key === row.beforeNode);
    return reveal
      ? this.transloco.translate('content.reveals.fromReveal', {
          point: this.pointText(reveal.point),
        })
      : this.transloco.translate('content.reveals.fromFirstAppearance');
  }

  // --- Editing: each change hands the whole reveals back to the editor, which holds them.

  protected addReveal(): void {
    const reveal = newReveal(this.languages());
    this.emit({ ...this.latest(), reveals: [...this.latest().reveals, reveal] });
    this.selected.set(reveal.key);
  }

  protected removeReveal(key: string): void {
    this.emit({
      ...this.latest(),
      reveals: this.latest().reveals.filter((reveal) => reveal.key !== key),
    });
    this.selected.set(null);
  }

  protected setPoint(key: string, axis: StoryPointPart, item: EntityReference | null): void {
    this.emit(
      withReveal(this.latest(), key, (reveal) => ({
        ...reveal,
        point: { ...reveal.point, [axis]: item },
      })),
    );
  }

  protected setTitle(key: string, language: string, title: string): void {
    this.emit(
      withReveal(this.latest(), key, (reveal) => ({
        ...reveal,
        titles: { ...reveal.titles, [language]: title },
      })),
    );
  }

  protected addGroup(key: string, group: string): void {
    if (!group) {
      return;
    }
    this.emit(withRevealedGroup(this.entity(), this.latest(), key, group, this.truth()));
    this.openGroup.set(group);
  }

  protected removeGroup(key: string, group: string): void {
    this.emit(withoutGroup(this.latest(), key, group));
  }

  /** A value of the initial knowledge, of a reveal, or of the main fields (`TRUTH_NODE`). */
  protected setValue(node: string, key: string, language: string | null, value: unknown): void {
    this.write(node, (belief) => withValue(belief, key, language, value));
  }

  /** A relation picked: its subcategory is cleared, it belonged to the one picked before. */
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

  /**
   * A change to a belief. On the main fields only the values changed go back: the truth is the
   * whole draft, and handing it back whole could write an older copy over a newer edit.
   */
  private write(node: string, change: (belief: Belief) => Belief): void {
    if (node === TRUTH_NODE) {
      this.truthChanged.emit(changedValues(this.truth(), change(this.truth())));
      return;
    }
    this.emit(withBelief(this.latest(), node, change));
  }

  private emit(reveals: RevealsDraft): void {
    this.latest.set(reveals);
    this.changed.emit(reveals);
  }
}

/** The values of `after` that differ from `before`: shared ones, then translated ones per language. */
function changedValues(before: Belief, after: Belief): Belief {
  const changed: Belief = { translations: {} };
  for (const [key, value] of Object.entries(after)) {
    if (key !== 'translations' && value !== before[key]) {
      changed[key] = value;
    }
  }
  for (const [language, values] of Object.entries(after.translations)) {
    for (const [key, value] of Object.entries(values)) {
      if (value !== before.translations[language]?.[key]) {
        changed.translations[language] = { ...changed.translations[language], [key]: value };
      }
    }
  }
  return changed;
}
