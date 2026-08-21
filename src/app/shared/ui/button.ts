import { Component, computed, input } from '@angular/core';
import { buttonClasses, type ButtonVariant } from './button-variants';

@Component({
  selector: 'app-button',
  templateUrl: './button.html',
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);

  protected readonly classes = computed(() => buttonClasses(this.variant()));
}
