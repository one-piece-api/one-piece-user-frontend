import { Component, inject } from '@angular/core';
import { ToastService, type ToastTone } from './toast';

const TONE_CLASSES: Record<ToastTone, string> = {
  info: 'border-ocean-700 text-ocean-900',
  success: 'border-success-500 text-success-700',
  error: 'border-flag-600 text-flag-700',
};

@Component({
  selector: 'app-toast-viewport',
  templateUrl: './toast-viewport.html',
})
export class ToastViewport {
  protected readonly toastService = inject(ToastService);
  protected readonly toneClasses = TONE_CLASSES;
}
