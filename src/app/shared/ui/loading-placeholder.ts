import { Component, input } from '@angular/core';

/** The Sunny bobbing on the waves, shown inside a card while its data is still loading. */
@Component({
  selector: 'app-loading-placeholder',
  templateUrl: './loading-placeholder.html',
})
export class LoadingPlaceholder {
  readonly label = input.required<string>();
}
