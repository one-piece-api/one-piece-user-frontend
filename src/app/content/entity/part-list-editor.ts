import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { entityOf } from './entities';
import type { PartField, PartListField } from './entity-definition';
import { localizedTextsOf, newPartEntryKey, type PartEntryDraft } from './entity-part-list';
import { isReference, referenceLabel, type EntityReference } from './entity-reference';
import { textOf } from './field-kinds';
import { RelationPicker } from './relation-picker';

/** What a list of parts became, and the value written - `index.part[.language]` - if one was. */
export interface PartListChange {
  readonly entries: PartEntryDraft[];
  /** `null` when entries were added, moved or removed: every refusal of the list is stale. */
  readonly touched: string | null;
}

/** One box of an entry: a text, a text in one language, a choice, a yes or no, a content. */
interface PartInput {
  readonly id: string;
  readonly part: PartField;
  /** The language of a localized text; `null` for any other part. */
  readonly language: string | null;
  readonly text: string;
  readonly checked: boolean;
  readonly reference: EntityReference | null;
  readonly error: string | null;
}

/**
 * The editor of a list of entries made of parts (`PartListField`) - a character's epithets,
 * aliases, species: add, remove, move up and down, and each entry's parts drawn as their
 * kinds are elsewhere in the editor, a localized part once per language of the catalog
 * (plan C3, decision 2). Holds nothing: every change goes back to the editor, which owns the
 * draft. `errors` are the backend's refusals of this list, by `index[.part[.language]]`.
 */
@Component({
  selector: 'app-part-list-editor',
  templateUrl: './part-list-editor.html',
  imports: [RelationPicker, TranslocoPipe],
})
export class PartListEditor {
  readonly field = input.required<PartListField>();
  /** The prefix of the entity's translation keys: its placeholders and options. */
  readonly i18n = input.required<string>();
  readonly entries = input.required<readonly PartEntryDraft[]>();
  /** The languages of the catalog, in its order. */
  readonly languages = input.required<readonly string[]>();
  readonly errors = input<Readonly<Record<string, string>>>({});
  readonly changed = output<PartListChange>();

  /** Whether each part has a label of its own: not for an entry of a single part. */
  protected readonly labelledParts = computed(() => this.field().parts.length > 1);

  protected readonly full = computed(() => {
    const max = this.field().maxEntries;
    return max !== undefined && this.entries().length >= max;
  });

  protected readonly views = computed(() => {
    const entries = this.entries();
    const errors = this.errors();
    return entries.map((entry, index) => ({
      key: entry.key,
      position: index + 1,
      first: index === 0,
      last: index === entries.length - 1,
      error: errors[String(index)] ?? null,
      parts: this.field().parts.map((part) => ({
        part,
        visible: this.isVisible(entry, part),
        maxLength: 'maxLength' in part ? part.maxLength : null,
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
    }));
  });

  /**
   * Whether a part is drawn: always, but for one with a condition on another part (`visibleWhen`),
   * which waits for it - unless it already holds a value, which must stay reachable.
   */
  private isVisible(entry: PartEntryDraft, part: PartField): boolean {
    const when = part.kind === 'choice' ? part.visibleWhen : undefined;
    if (!when) {
      return true;
    }
    const chosen = entry.values[when.part];
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
    const id = `draft-${this.field().key}-${index}-${part.key}`;
    const base = { part, text: '', checked: false, reference: null };
    if (part.kind === 'localizedText') {
      const texts = localizedTextsOf(value);
      return this.languages().map((language) => ({
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
    this.changed.emit({ entries: [...this.entries(), added], touched: null });
  }

  protected remove(index: number): void {
    this.changed.emit({
      entries: this.entries().filter((_, position) => position !== index),
      touched: null,
    });
  }

  /** Moves an entry one place up (-1) or down (+1): the order is the display order. */
  protected move(index: number, step: -1 | 1): void {
    const entries = [...this.entries()];
    const target = index + step;
    if (target < 0 || target >= entries.length) {
      return;
    }
    [entries[index], entries[target]] = [entries[target], entries[index]];
    this.changed.emit({ entries, touched: null });
  }

  /** Writes a part: a text - in one language for a localized one - a choice, a flag or a content. */
  protected write(index: number, input: PartInput, value: unknown): void {
    const { part, language } = input;
    const entry = this.entries()[index];
    const written =
      language === null
        ? value
        : { ...localizedTextsOf(entry.values[part.key]), [language]: value };
    // A part that waits for this one is cleared: what it said was about the previous content.
    const cleared = Object.fromEntries(
      this.field()
        .parts.filter((other) => other.kind === 'choice' && other.visibleWhen?.part === part.key)
        .map((other) => [other.key, '']),
    );
    this.changed.emit({
      entries: this.entries().map((candidate, position) =>
        position === index
          ? { ...candidate, values: { ...candidate.values, ...cleared, [part.key]: written } }
          : candidate,
      ),
      touched: [index, part.key, language].filter((segment) => segment !== null).join('.'),
    });
  }
}
