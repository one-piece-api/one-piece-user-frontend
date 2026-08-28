import { Component, input } from '@angular/core';

/** The small "eyebrow label + heading" chip topping every app page, per the Sunny Deck direction. */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.html',
})
export class PageHeader {
  readonly eyebrow = input.required<string>();
}
