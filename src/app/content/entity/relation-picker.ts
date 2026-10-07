import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject, debounceTime } from 'rxjs';
import type { PageResponse } from '../../shared/http/page-response';
import { referenceLabel, type EntityReference } from './entity-reference';

/** How long the choice waits after the last keystroke before asking the backend. */
const SEARCH_DEBOUNCE_MS = 300;

/** How many choices are asked for at a time - the most the backend gives. */
const CHOICES_PER_SEARCH = 20;

/** One choice, named in the language on screen. */
interface Choice {
  readonly reference: EntityReference;
  readonly label: string;
  readonly id: string;
  readonly active: boolean;
  readonly selected: boolean;
}

/**
 * Chooses the content a draft points to, searching among those it may point to: a combobox
 * (WAI-ARIA) whose list is read from `{source}/linkable`, a page of references the backend
 * has already narrowed to the contents that can be linked, by `q`. The value is the whole
 * reference, so the choice is named at once even when it is not among the results. Clearing
 * it points to nothing: a draft may not have chosen yet. It knows nothing of what the
 * contents are - the editor gives it the section to ask and takes the choice back.
 */
@Component({
  selector: 'app-relation-picker',
  templateUrl: './relation-picker.html',
  imports: [TranslocoPipe],
})
export class RelationPicker {
  private readonly transloco = inject(TranslocoService);

  /** The id of the text box, for the label that names it. */
  readonly inputId = input.required<string>();
  /** The section of the content pointed to, e.g. `/api/content/devil-fruit-types`. */
  readonly source = input.required<string>();
  readonly value = input<EntityReference | null>(null);
  readonly placeholder = input('');
  /** The backend refused the choice: the box is marked. */
  readonly invalid = input(false);

  /** The reader chose a content - or `null`, none. */
  readonly picked = output<EntityReference | null>();

  protected readonly open = signal(false);
  /** What the box shows while the list is open: what is being typed. */
  protected readonly typed = signal('');
  /** What is searched for: follows the typing, a moment later. */
  private readonly search = signal('');
  private readonly activeIndex = signal(-1);
  private readonly typings = new Subject<string>();

  protected readonly listboxId = computed(() => `${this.inputId()}-listbox`);

  private readonly results = httpResource<PageResponse<EntityReference>>(() => {
    if (!this.open()) {
      return undefined;
    }
    const query = new URLSearchParams();
    if (this.search()) {
      query.set('q', this.search());
    }
    query.set('size', String(CHOICES_PER_SEARCH));
    return `${this.source()}/linkable?${query}`;
  });

  protected readonly choices = computed<Choice[]>(() => {
    const language = this.transloco.activeLang();
    const chosen = this.value()?.id;
    const found = this.results.hasValue() ? this.results.value().content : [];
    return found.map((reference, index) => ({
      reference,
      label: referenceLabel(reference, language),
      id: `${this.inputId()}-option-${index}`,
      active: index === this.activeIndex(),
      selected: reference.id === chosen,
    }));
  });

  /** What the list says instead of choices: still searching, failed, or nothing found. */
  protected readonly status = computed<'searching' | 'error' | 'empty' | null>(() => {
    if (this.results.error()) {
      return 'error';
    }
    if (!this.results.hasValue()) {
      return 'searching';
    }
    return this.choices().length === 0 ? 'empty' : null;
  });

  protected readonly activeId = computed(
    () => this.choices().find((choice) => choice.active)?.id ?? null,
  );

  /** The chosen content's name, or what is typed while the list is open. */
  protected readonly shown = computed(() => {
    if (this.open()) {
      return this.typed();
    }
    const value = this.value();
    return value ? referenceLabel(value, this.transloco.activeLang()) : '';
  });

  constructor() {
    this.typings.pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed()).subscribe((text) => {
      this.search.set(text.trim());
      this.activeIndex.set(-1);
    });
  }

  protected openList(): void {
    if (!this.open()) {
      this.typed.set('');
      this.search.set('');
      this.activeIndex.set(-1);
      this.open.set(true);
    }
  }

  protected closeList(): void {
    this.open.set(false);
  }

  protected onInput(text: string): void {
    this.openList();
    this.typed.set(text);
    this.typings.next(text);
  }

  protected choose(reference: EntityReference): void {
    this.picked.emit(reference);
    this.closeList();
  }

  protected clear(): void {
    this.picked.emit(null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.choices().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.openList();
        this.activeIndex.update((index) => Math.min(index + 1, count - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((index) => Math.max(index - 1, 0));
        break;
      case 'Enter': {
        const active = this.choices().find((choice) => choice.active);
        if (this.open() && active) {
          event.preventDefault();
          this.choose(active.reference);
        }
        break;
      }
      case 'Escape':
        if (this.open()) {
          event.stopPropagation();
          this.closeList();
        }
        break;
    }
  }
}
