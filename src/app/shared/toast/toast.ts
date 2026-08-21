import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const AUTO_DISMISS_MS = 5000;

/** On-theme replacement for a silent page refresh: every state-changing action gets one of these. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private lastId = 0;

  readonly toasts = signal<readonly Toast[]>([]);

  show(message: string, tone: ToastTone = 'info'): void {
    const id = ++this.lastId;
    this.toasts.update((current) => [...current, { id, message, tone }]);
    setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((current) => current.filter((toast) => toast.id !== id));
  }
}
