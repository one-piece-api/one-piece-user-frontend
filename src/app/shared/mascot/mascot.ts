import { Injectable, signal } from '@angular/core';

export type MascotTone = 'info' | 'success' | 'error';

export interface MascotMessage {
  readonly tone: MascotTone;
  readonly title: string;
  readonly text: string;
  readonly code?: string;
}

const TITLES: Record<MascotTone, string> = {
  info: 'Puru puru puru',
  success: 'Yosh! All Done',
  error: 'Arrr! Blocked',
};

const AUTO_DISMISS_MS = 9000;

const IDLE_GREETING: MascotMessage = {
  tone: 'info',
  title: TITLES.info,
  text: "I'm here! I'll pipe up when something needs your attention, or tap me any time for a pointer.",
  code: 'standing by',
};

/**
 * The Den Den Mushi: a single-message assistant bubble, not a stack - the latest message
 * always replaces whatever came before it, same as the reference mockup's mascot. Errors
 * stay open until dismissed by hand; everything else closes itself after a while, same
 * timing the old stacked toasts used.
 */
@Injectable({ providedIn: 'root' })
export class MascotService {
  private dismissTimer?: ReturnType<typeof setTimeout>;

  readonly open = signal(false);
  readonly message = signal<MascotMessage>(IDLE_GREETING);

  show(text: string, tone: MascotTone = 'info', code?: string): void {
    this.message.set({ tone, title: TITLES[tone], text, code });
    this.open.set(true);
    this.scheduleAutoClose(tone);
  }

  /** Reopens with whatever message is already loaded when closed; collapses when open. */
  toggle(): void {
    this.open.update((isOpen) => !isOpen);
    if (this.open()) {
      this.scheduleAutoClose(this.message().tone);
    } else {
      clearTimeout(this.dismissTimer);
    }
  }

  close(): void {
    clearTimeout(this.dismissTimer);
    this.open.set(false);
  }

  private scheduleAutoClose(tone: MascotTone): void {
    clearTimeout(this.dismissTimer);
    if (tone !== 'error') {
      this.dismissTimer = setTimeout(() => this.open.set(false), AUTO_DISMISS_MS);
    }
  }
}
