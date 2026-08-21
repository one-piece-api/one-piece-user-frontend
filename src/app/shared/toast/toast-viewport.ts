import { Component, inject } from '@angular/core';
import { ToastService, type ToastTone } from './toast';

const TONE_CLASSES: Record<ToastTone, string> = {
  info: 'border-ocean-500 bg-ocean-900 text-parchment-50',
  success: 'border-treasure-600 bg-treasure-500 text-ocean-950',
  error: 'border-flag-600 bg-flag-500 text-parchment-50',
};

@Component({
  selector: 'app-toast-viewport',
  templateUrl: './toast-viewport.html',
})
export class ToastViewport {
  protected readonly toastService = inject(ToastService);
  protected readonly toneClasses = TONE_CLASSES;
}
