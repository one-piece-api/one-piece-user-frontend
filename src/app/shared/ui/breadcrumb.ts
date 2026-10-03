import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

/** One step of the trail: `label` is display text, `route` makes the step a link. */
export interface Crumb {
  readonly label: string;
  readonly icon?: string;
  readonly route?: string;
}

/**
 * The trail above a page, as one pill: every step but the last may be a link, the last one
 * is where the reader is.
 */
@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.html',
  imports: [RouterLink, Icon],
})
export class Breadcrumb {
  readonly crumbs = input.required<readonly Crumb[]>();
}
