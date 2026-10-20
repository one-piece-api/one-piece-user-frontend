import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ENTITY } from './entities';
import type { EntityBody } from './entity-body';
import type { ChainSection } from './entity-definition';
import { isReference, referenceLabel } from './entity-reference';

/** One link of the chain, ready to render. */
interface ChainEntry {
  readonly id: string;
  readonly label: string;
  /** The content on screen: marked, and not a link to itself. */
  readonly current: boolean;
  readonly link: readonly string[];
}

/**
 * The chain a version is part of, as the backend sends it with the version (`section.field`):
 * contents of the same entity, newest first, the one on screen included and marked - a
 * person's bounties, each leading to its own. Not shown while the chain is that one alone.
 */
@Component({
  selector: 'app-chain-list',
  templateUrl: './chain-list.html',
  imports: [RouterLink, TranslocoPipe],
})
export class ChainList {
  private readonly transloco = inject(TranslocoService);
  protected readonly entity = inject(ENTITY);

  readonly section = input.required<ChainSection>();
  readonly body = input.required<EntityBody>();
  readonly contentId = input.required<string>();

  protected readonly entries = computed<ChainEntry[]>(() => {
    const language = this.transloco.activeLang();
    const chain = this.body()[this.section().field];
    const references = Array.isArray(chain) ? chain.filter(isReference) : [];
    return references.map((reference) => ({
      id: reference.id,
      label: referenceLabel(reference, language, this.entity),
      current: reference.id === this.contentId(),
      link: [this.entity.route, reference.id],
    }));
  });
}
