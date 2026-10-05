import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** One step of the trail: `label` is display text, `route` makes the step a link. Text only, no icons. */
export interface Crumb {
  readonly label: string;
  readonly route?: string;
}

/**
 * The trail above a page, as one pill: every step but the last may be a link, the last one
 * is where the reader is.
 */
@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.html',
  imports: [RouterLink],
})
export class Breadcrumb {
  readonly crumbs = input.required<readonly Crumb[]>();
}
