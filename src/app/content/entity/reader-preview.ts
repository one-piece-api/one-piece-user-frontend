import { httpResource } from '@angular/common/http';
import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { LanguageEntry } from '../language-catalog';
import type { EntityBody } from './entity-body';
import { EntityCard } from './entity-card';
import {
  AXES,
  positionNumberOf,
  positionOf,
  previewUrl,
  type Axis,
  type HiddenEntry,
  type Preview,
  type ReaderPosition,
} from './entity-preview';

/**
 * The Preview tab (UF-CNT-23, reveals plan R9): a version as the reader sees it at chapter or
 * episode N. The position lives in the URL, held by the page; this only asks the backend for the
 * resolved body and draws it with the same card as the Overview. Nothing is computed here.
 */
@Component({
  selector: 'app-reader-preview',
  templateUrl: './reader-preview.html',
  imports: [EntityCard, TranslocoPipe],
})
export class ReaderPreview {
  /** The version's own URL, e.g. `/api/content/characters/{id}/versions/2`. */
  readonly versionUrl = input.required<string>();
  readonly languages = input.required<readonly LanguageEntry[]>();
  /** Where the reader is, from the URL; `null` until a valid one is chosen. */
  readonly position = input<ReaderPosition | null>(null);
  /** The editor chose another position. */
  readonly chosen = output<ReaderPosition>();

  protected readonly axes = AXES;
  protected readonly axisDraft = linkedSignal<Axis>(() => this.position()?.axis ?? 'chapter');
  protected readonly numberDraft = linkedSignal(() => String(this.position()?.number ?? ''));
  /** The number typed is not a whole number of 1 or more. */
  protected readonly numberRefused = computed(
    () => this.numberDraft().trim() !== '' && positionNumberOf(this.numberDraft()) === null,
  );

  private readonly preview = httpResource<Preview<EntityBody>>(() => {
    const position = this.position();
    return position ? previewUrl(this.versionUrl(), position) : undefined;
  });

  protected readonly state = computed<'idle' | 'loading' | 'error' | 'ready'>(() => {
    if (!this.position()) {
      return 'idle';
    }
    if (this.preview.error()) {
      return 'error';
    }
    return this.preview.hasValue() ? 'ready' : 'loading';
  });
  protected readonly result = computed(() =>
    this.state() === 'ready' ? this.preview.value() : null,
  );
  protected readonly hiddenEntries = computed<readonly HiddenEntry[]>(
    () => this.result()?.hiddenEntries ?? [],
  );

  protected pickAxis(axis: Axis): void {
    this.axisDraft.set(axis);
    this.submit();
  }

  /** Asks for the position typed, if it is valid: on Enter and on leaving the field. */
  protected submit(): void {
    const position = positionOf(this.axisDraft(), this.numberDraft());
    const current = this.position();
    if (position && (position.axis !== current?.axis || position.number !== current?.number)) {
      this.chosen.emit(position);
    }
  }

  protected typed(event: Event): void {
    this.numberDraft.set((event.target as HTMLInputElement).value);
  }
}
