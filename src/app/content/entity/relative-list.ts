import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ENTITY } from './entities';
import type { EntityBody } from './entity-body';
import type { RelativeListSection } from './entity-definition';
import { isReference, referenceLabel } from './entity-reference';

/** The gender a label falls back to where the relative's is not known. */
const NO_GENDER = 'UNKNOWN';

/** One content of the section, ready to render. */
interface RelativeEntry {
  readonly id: string;
  readonly label: string;
  /** What this content is to the one on screen, worded after its gender: "Nonno". */
  readonly kind: string;
  readonly link: readonly string[];
}

/**
 * The contents that name this one in a list of theirs - the relatives other characters stored,
 * as the backend sends them with the content (`section.field`) with the kind already read from
 * this side. Read-only: the tie belongs to the other content, so it is changed there. Not part
 * of the version, so the page shows it on the current one only.
 */
@Component({
  selector: 'app-relative-list',
  templateUrl: './relative-list.html',
  imports: [RouterLink, TranslocoPipe],
})
export class RelativeList {
  private readonly transloco = inject(TranslocoService);
  protected readonly entity = inject(ENTITY);

  readonly section = input.required<RelativeListSection>();
  readonly body = input.required<EntityBody>();

  protected readonly entries = computed<RelativeEntry[]>(() => {
    const language = this.transloco.activeLang();
    const { field, group } = this.section();
    const ties = this.body()[field];
    return (Array.isArray(ties) ? ties : []).flatMap((tie: unknown) => {
      const { relative, kind } = (tie ?? {}) as { relative?: unknown; kind?: unknown };
      if (!isReference(relative) || typeof kind !== 'string') {
        return [];
      }
      const gender = typeof relative['gender'] === 'string' ? relative['gender'] : NO_GENDER;
      return [
        {
          id: relative.id,
          label: referenceLabel(relative, language, this.entity),
          kind: this.transloco.translate(`${this.entity.i18n}.${group}.${kind}.${gender}`),
          link: [this.entity.route, relative.id],
        },
      ];
    });
  });
}
