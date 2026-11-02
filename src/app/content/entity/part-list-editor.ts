import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { entityOf } from './entities';
import {
  labelKeyOf,
  type ImageField,
  type PartField,
  type PartListField,
  type ValuePartField,
} from './entity-definition';
import {
  isPartEntryDraft,
  itemsOf,
  localizedTextsOf,
  newPartEntryKey,
  type PartEntryDraft,
} from './entity-part-list';
import { isReference, referenceLabel, type EntityReference } from './entity-reference';
import {
  STORY_POINT_PARTS,
  STORY_POINT_TARGETS,
  storyItemLabel,
  storyPointOf,
  type StoryPointPart,
} from './entity-story-point';
import { mainPortraitIndex } from './entity-gallery';
import { isImageDraft, type ImageDraft } from './entity-image';
import { isAskedByReview, sentPartEntries, textOf } from './field-kinds';
import { ImagePicker } from './image-picker';
import { RelationPicker } from './relation-picker';

/** What a list of parts became, and the value written - `index.part[.language]` - if one was. */
export interface PartListChange {
  readonly entries: PartEntryDraft[];
  /** `null` when entries were added, moved or removed: every refusal of the list is stale. */
  readonly touched: string | null;
}

/**
 * The axes on which the content has a first appearance: a point of a window may have a part
 * only there (workflow 3.7.4). Neither, for a content without a first appearance yet.
 */
export type StoryAxes = Readonly<Record<StoryPointPart, boolean>>;

/** One box of an entry: a text, a text in one language, a choice, a yes or no, a content, an image. */
interface PartInput {
  readonly id: string;
  readonly part: PartField;
  /** The language of a localized text; `null` for any other part. */
  readonly language: string | null;
  readonly text: string;
  readonly checked: boolean;
  readonly reference: EntityReference | null;
  readonly image: ImageDraft | null;
  readonly error: string | null;
}

/** One language of the list's switch, with what its entries still miss or had refused there. */
interface LanguageTab {
  readonly code: string;
  readonly label: string;
  readonly selected: boolean;
  readonly incomplete: boolean;
  readonly refused: boolean;
}

/** One picker of a window's point: its chapter or its episode. */
interface AxisPicker {
  readonly axis: StoryPointPart;
  readonly id: string;
  readonly source: string;
  readonly value: EntityReference | null;
  /** The content has no first appearance on this axis and the point has nothing there. */
  readonly disabled: boolean;
  /** The point has a part on an axis the content has no first appearance on: to clear. */
  readonly offAxis: boolean;
  readonly invalid: boolean;
}

/** `discovered` or `ended` of an entry's window, ready to draw. */
interface PointView {
  readonly key: string;
  readonly pickers: readonly AxisPicker[];
  readonly error: string | null;
}

/**
 * The editor of a list of entries made of parts (`PartListField`) - a character's epithets,
 * aliases, species: add, remove, move up and down, and each entry's parts drawn as their
 * kinds are elsewhere in the editor, a localized part in one language at a time, chosen with the
 * list's language switch as the editor's tabs do for the translated fields. An entry of a `windowed` list has its window under its parts:
 * `discovered` always, `ended` behind a button unless it has one (reveals plan R8, decision 2);
 * a nested list (a membership's periods) is this same editor, drawn inside the entry; an image
 * part (a gallery's) is drawn beside the others, and the main portrait is marked on its entry
 * (gallery decisions 1-2). Holds
 * nothing: every change goes back to the editor, which owns the draft. `errors` are the
 * backend's refusals of this list, by `index[.part[.language]]`.
 */
@Component({
  selector: 'app-part-list-editor',
  templateUrl: './part-list-editor.html',
  imports: [ImagePicker, RelationPicker, TranslocoPipe],
})
export class PartListEditor {
  private readonly transloco = inject(TranslocoService);

  readonly field = input.required<PartListField>();
  /** The prefix of the entity's translation keys: its placeholders and options. */
  readonly i18n = input.required<string>();
  readonly entries = input.required<readonly PartEntryDraft[]>();
  /**
   * The entries as this editor last wrote them, until the page hands them back: two writes in a
   * row - a point picked, then a rank chosen before the page redraws - build on each other
   * instead of the second undoing the first.
   */
  private readonly current = linkedSignal(() => this.entries());
  /** The languages of the catalog, in its order. */
  readonly languages = input.required<readonly string[]>();
  readonly errors = input<Readonly<Record<string, string>>>({});
  /** Where the content has a first appearance; a window's pickers follow it (decision 3). */
  readonly axes = input<StoryAxes>({ chapter: true, episode: true });
  /**
   * For a nested list, the path of its labels after `content.editor.` (`affiliations.periods`)
   * and the values of the entry holding it, which a part may wait for (`visibleWhen`).
   */
  readonly labelPath = input<string | null>(null);
  readonly context = input<Readonly<Record<string, unknown>>>({});
  /** The start of each box's id: `draft-affiliations-0-periods` for a nested list. */
  readonly idPrefix = input<string | null>(null);
  /** For a nested list, the language the list holding it shows: it has no switch of its own. */
  readonly language = input<string | null>(null);
  /** The language of the editor's tabs: the switch starts there, and follows when it changes. */
  readonly defaultLanguage = input<string | null>(null);
  readonly changed = output<PartListChange>();

  protected readonly nested = computed(() => this.labelPath() !== null);
  /** A test id of this list - `sub-part-add` in a nested one, so it never shadows the outer one. */
  protected testId(name: string): string {
    return this.nested() ? `sub-${name}` : name;
  }

  protected readonly labels = computed(() => this.labelPath() ?? labelKeyOf(this.field()));
  protected readonly ids = computed(() => this.idPrefix() ?? `draft-${this.field().key}`);

  /** The value parts, each with a label of its own: not for an entry of a single part. */
  protected readonly labelledParts = computed(
    () => this.field().parts.length > 1 || !!this.field().windowed,
  );

  protected readonly full = computed(() => {
    const max = this.field().maxEntries;
    return max !== undefined && this.current().length >= max;
  });

  /**
   * The language chosen on this list's switch: the editor's own until one is picked here, else
   * the first of the catalog.
   */
  private readonly chosenLanguage = linkedSignal<string | null>(
    () => this.defaultLanguage() ?? this.languages()[0] ?? null,
  );

  /** The language every localized part of the list is written in right now. */
  protected readonly shownLanguage = computed(() => this.language() ?? this.chosenLanguage());

  /**
   * The language switch of a list with text per language, in its parts or a nested list's: a
   * language is incomplete when an entry the draft sends lacks a text review asks for there,
   * refused when the backend refused one.
   */
  protected readonly languageTabs = computed<LanguageTab[]>(() => {
    if (this.nested() || !hasLocalizedParts(this.field())) {
      return [];
    }
    const refused = Object.keys(this.errors());
    return this.languages().map((code) => ({
      code,
      label: code.toUpperCase(),
      selected: code === this.shownLanguage(),
      incomplete: missesLanguage(this.field(), this.current(), code),
      refused: refused.some((key) => key.endsWith(`.${code}`)),
    }));
  });

  protected chooseLanguage(code: string): void {
    this.chosenLanguage.set(code);
  }

  /** The entries whose `ended` the editor opened before writing it, by entry key. */
  private readonly endOpened = signal<ReadonlySet<string>>(new Set());

  protected readonly noAxis = computed(() => !this.axes().chapter && !this.axes().episode);

  protected readonly views = computed(() => {
    const entries = this.current();
    const errors = this.errors();
    const portrait = mainPortraitIndex(this.field(), entries);
    this.transloco.activeLang();
    return entries.map((entry, index) => {
      const ended = storyPointOf(entry.values['ended']);
      return {
        key: entry.key,
        position: index + 1,
        first: index === 0,
        last: index === entries.length - 1,
        error: errors[String(index)] ?? null,
        mainPortrait: portrait === index,
        images: this.imageParts().map((part) => ({
          part,
          id: `${this.ids()}-${index}-${part.key}`,
          value: isImageDraft(entry.values[part.key])
            ? (entry.values[part.key] as ImageDraft)
            : null,
          error: errors[`${index}.${part.key}`] ?? null,
        })),
        parts: this.valueParts().map((part) => ({
          part,
          visible: this.isVisible(entry, part),
          maxLength: 'maxLength' in part ? part.maxLength : null,
          // A long text - a paragraph - is a box of `rows` lines.
          rows: part.kind === 'localizedText' ? (part.rows ?? null) : null,
          source: part.kind === 'relation' ? (entityOf(part.target)?.api ?? null) : null,
          labelOf: (reference: EntityReference, language: string) =>
            referenceLabel(
              reference,
              language,
              part.kind === 'relation' ? entityOf(part.target) : null,
            ),
          options:
            part.kind === 'choice'
              ? part.options.map((option) => ({
                  value: option,
                  labelKey: `${this.i18n()}.options.${part.key}.${option}`,
                }))
              : [],
          inputs: this.inputsOf(entry, index, part, errors),
        })),
        windowed: !!this.field().windowed,
        anyPoint: ['discovered', 'ended'].some((point) => {
          const { chapter, episode } = storyPointOf(entry.values[point]);
          return chapter !== null || episode !== null;
        }),
        discovered: this.pointView(entry, index, 'discovered', errors),
        ended: this.pointView(entry, index, 'ended', errors),
        endShown:
          ended.chapter !== null || ended.episode !== null || this.endOpened().has(entry.key),
        lists: this.nestedLists().map((list) => ({
          list,
          entries: itemsOf(entry.values[list.key]).filter(isPartEntryDraft),
          errors: subErrors(errors, `${index}.${list.key}.`),
          context: { ...this.context(), ...entry.values },
          idPrefix: `${this.ids()}-${index}-${list.key}`,
          labelPath: `${this.labels()}.${list.key}`,
        })),
      };
    });
  });

  /** The parts drawn as boxes: every part but a nested list and an image. */
  private readonly valueParts = computed(() =>
    this.field().parts.filter(
      (part): part is ValuePartField => part.kind !== 'partList' && part.kind !== 'image',
    ),
  );

  /** The image parts, drawn on the side of the entry: a gallery's. */
  private readonly imageParts = computed(() =>
    this.field().parts.filter((part): part is ImageField => part.kind === 'image'),
  );

  /** Whether the entries have an image on their side, the other parts beside it. */
  protected readonly withImage = computed(() => this.imageParts().length > 0);

  private readonly nestedLists = computed(() =>
    this.field().parts.filter((part): part is PartListField => part.kind === 'partList'),
  );

  /** The chapter and episode pickers the app can offer, with how each names a choice. */
  protected readonly axisSources = STORY_POINT_PARTS.map((axis) => ({
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

  /**
   * A point of the window with its pickers, each guarded by the axes of the first appearance:
   * disabled where the content has none and the point is empty there, flagged where the point
   * has a part there anyway, so the editor clears it - never dropped here (decision 3).
   */
  private pointView(
    entry: PartEntryDraft,
    index: number,
    key: string,
    errors: Readonly<Record<string, string>>,
  ): PointView {
    const point = storyPointOf(entry.values[key]);
    const axes = this.axes();
    const pickers = this.axisSources.map(({ axis, source }): AxisPicker => {
      const value = point[axis];
      const offAxis = !axes[axis] && value !== null;
      return {
        axis,
        id: `${this.ids()}-${index}-${key}${axis === 'chapter' ? '' : '-' + axis}`,
        source,
        value,
        disabled: !axes[axis] && value === null,
        offAxis,
        invalid: offAxis || !!(errors[`${index}.${key}`] ?? errors[`${index}.${key}.${axis}`]),
      };
    });
    const error =
      errors[`${index}.${key}`] ??
      STORY_POINT_PARTS.map((axis) => errors[`${index}.${key}.${axis}`]).find(Boolean) ??
      null;
    return { key, pickers, error };
  }

  /**
   * Whether a part is drawn: always, but for one with a condition on another part (`visibleWhen`),
   * of this entry or of the one holding the list, which waits for it - unless it already holds a
   * value, which must stay reachable.
   */
  private isVisible(entry: PartEntryDraft, part: PartField): boolean {
    const when = part.kind === 'choice' ? part.visibleWhen : undefined;
    if (!when) {
      return true;
    }
    const chosen = when.part in entry.values ? entry.values[when.part] : this.context()[when.part];
    return (
      (isReference(chosen) && chosen[when.field] === when.equals) ||
      textOf(entry.values[part.key]) !== ''
    );
  }

  private inputsOf(
    entry: PartEntryDraft,
    index: number,
    part: PartField,
    errors: Readonly<Record<string, string>>,
  ): PartInput[] {
    const value = entry.values[part.key];
    const id = `${this.ids()}-${index}-${part.key}`;
    const base = { part, text: '', checked: false, reference: null, image: null };
    if (part.kind === 'localizedText') {
      const texts = localizedTextsOf(value);
      const shown = this.shownLanguage();
      return this.languages()
        .filter((language) => language === shown)
        .map((language) => ({
          ...base,
          id: `${id}-${language}`,
          language,
          text: texts[language] ?? '',
          error: errors[`${index}.${part.key}.${language}`] ?? null,
        }));
    }
    return [
      {
        ...base,
        id,
        language: null,
        text: textOf(value),
        checked: value === true,
        reference: isReference(value) ? value : null,
        error: errors[`${index}.${part.key}`] ?? null,
      },
    ];
  }

  /** Adds an empty entry at the end; one left empty is not saved. */
  protected add(): void {
    if (this.full()) {
      return;
    }
    const added: PartEntryDraft = { key: newPartEntryKey(), values: {} };
    this.emit({ entries: [...this.current(), added], touched: null });
  }

  protected remove(index: number): void {
    this.emit({
      entries: this.current().filter((_, position) => position !== index),
      touched: null,
    });
  }

  /** Moves an entry one place up (-1) or down (+1): the order is the display order. */
  protected move(index: number, step: -1 | 1): void {
    const entries = [...this.current()];
    const target = index + step;
    if (target < 0 || target >= entries.length) {
      return;
    }
    [entries[index], entries[target]] = [entries[target], entries[index]];
    this.emit({ entries, touched: null });
  }

  /** Writes a part: a text - in one language for a localized one - a choice, a flag or a content. */
  protected write(index: number, input: PartInput, value: unknown): void {
    const { part, language } = input;
    const entry = this.current()[index];
    const written =
      language === null
        ? value
        : { ...localizedTextsOf(entry.values[part.key]), [language]: value };
    this.writeValue(
      index,
      part.key,
      written,
      [index, part.key, language].filter((segment) => segment !== null).join('.'),
    );
  }

  /**
   * Chooses the image of an entry - a file already checked by the picker - or none. The image
   * replaced, if just chosen, lets its preview go.
   */
  protected writeImage(index: number, part: ImageField, file: File | null): void {
    const previous = this.current()[index].values[part.key];
    if (isImageDraft(previous) && 'chosen' in previous) {
      URL.revokeObjectURL(previous.preview);
    }
    const image: ImageDraft | null = file
      ? { chosen: file, preview: URL.createObjectURL(file) }
      : null;
    this.writeValue(index, part.key, image, `${index}.${part.key}`);
  }

  /** Picks the chapter or the episode of a point of the window - or none. */
  protected writePoint(
    index: number,
    point: string,
    axis: StoryPointPart,
    item: EntityReference | null,
  ): void {
    const current = storyPointOf(this.current()[index].values[point]);
    this.writeValue(index, point, { ...current, [axis]: item }, `${index}.${point}.${axis}`);
  }

  /** Opens the `ended` of an entry, still empty: it is saved once a part is picked. */
  protected openEnd(key: string): void {
    this.endOpened.update((opened) => new Set([...opened, key]));
  }

  /** Takes the end away: the entry is current again. */
  protected removeEnd(index: number, key: string): void {
    this.endOpened.update(
      (opened) => new Set([...opened].filter((candidate) => candidate !== key)),
    );
    this.writeValue(index, 'ended', { chapter: null, episode: null }, `${index}.ended`);
  }

  /** Takes what a nested list of an entry became (a membership's periods). */
  protected writeNested(index: number, list: PartListField, change: PartListChange): void {
    this.writeValue(
      index,
      list.key,
      change.entries,
      change.touched === null ? null : `${index}.${list.key}.${change.touched}`,
    );
  }

  /**
   * Writes one value of an entry. A part that waits for this one is cleared - what it said was
   * about the previous content - in this entry and in the entries of its nested lists (the
   * rank of each period, when the affiliation changes).
   */
  private writeValue(index: number, key: string, value: unknown, touched: string | null): void {
    const waiting = (parts: readonly PartField[]) =>
      Object.fromEntries(
        parts
          .filter((other) => other.kind === 'choice' && other.visibleWhen?.part === key)
          .map((other) => [other.key, '']),
      );
    const cleared = waiting(this.field().parts);
    const nestedCleared = Object.fromEntries(
      this.nestedLists().flatMap((list) => {
        const inList = waiting(list.parts);
        return Object.keys(inList).length ? [[list.key, inList] as const] : [];
      }),
    );
    this.emit({
      entries: this.current().map((candidate, position) => {
        if (position !== index) {
          return candidate;
        }
        const values: Record<string, unknown> = { ...candidate.values, ...cleared };
        for (const [list, reset] of Object.entries(nestedCleared)) {
          values[list] = itemsOf(values[list])
            .filter(isPartEntryDraft)
            .map((sub) => ({ ...sub, values: { ...sub.values, ...reset } }));
        }
        values[key] = value;
        return { ...candidate, values };
      }),
      touched,
    });
  }

  /** Hands a change to the page, keeping it as the entries the next write builds on. */
  private emit(change: PartListChange): void {
    this.current.set(change.entries);
    this.changed.emit(change);
  }
}

/** The refusals under a prefix (`0.periods.`), keyed by what follows it. */
function subErrors(
  errors: Readonly<Record<string, string>>,
  prefix: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, text]) => [key.slice(prefix.length), text]),
  );
}

/** Whether a list has text per language: in its own parts, or in a nested list's. */
function hasLocalizedParts(field: PartListField): boolean {
  return field.parts.some(
    (part) =>
      part.kind === 'localizedText' || (part.kind === 'partList' && hasLocalizedParts(part)),
  );
}

/**
 * Whether an entry the draft sends lacks, in `language`, a text review asks for - its own or
 * in a nested list's entries: the switch marks that language incomplete.
 */
function missesLanguage(field: PartListField, entries: unknown, language: string): boolean {
  return sentPartEntries(field, entries).some((entry) =>
    field.parts.some((part) => {
      if (part.kind === 'partList') {
        return missesLanguage(part, entry.values[part.key], language);
      }
      return (
        part.kind === 'localizedText' &&
        isAskedByReview(part) &&
        !localizedTextsOf(entry.values[part.key])[language]?.trim()
      );
    }),
  );
}
