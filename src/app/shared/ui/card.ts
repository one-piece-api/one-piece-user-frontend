import { Component, computed, input } from '@angular/core';

/** The "wanted poster" panel look, reused for every card-shaped block in the app. */
@Component({
  selector: 'app-card',
  templateUrl: './card.html',
})
export class Card {
  /** Widens the panel for content that needs more room than a single poster, e.g. a table. */
  readonly wide = input(false);

  protected readonly widthClass = computed(() => (this.wide() ? 'max-w-4xl' : 'max-w-md'));
}
