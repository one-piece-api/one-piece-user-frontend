import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type MascotTone = 'info' | 'success' | 'error';

export interface MascotMessage {
  readonly tone: MascotTone;
  readonly title: string;
  readonly text: string;
  readonly code?: string;
}

const TITLE_KEY: Record<MascotTone, string> = {
  info: 'mascot.title.info',
  success: 'mascot.title.success',
  error: 'mascot.title.error',
};

const AUTO_DISMISS_MS = 9000;

/**
 * The Den Den Mushi: a single-message assistant bubble, not a stack - the latest message
 * always replaces whatever came before it, same as the reference mockup's mascot. Errors
 * stay open until dismissed by hand; everything else closes itself after a while, same
 * timing the old stacked toasts used.
 */
@Injectable({ providedIn: 'root' })
export class MascotService {
  private readonly transloco = inject(TranslocoService);
  private dismissTimer?: ReturnType<typeof setTimeout>;

  readonly open = signal(false);

  /** `null` until the first `show()` - the idle greeting is computed lazily (not snapshotted
   * at construction) so it always reads whichever catalog is loaded by the time something
   * actually displays it, and updates on its own if the language changes while it's showing. */
  private readonly shown = signal<MascotMessage | null>(null);
  readonly message = computed<MascotMessage>(() => this.shown() ?? this.idleGreeting());

  show(text: string, tone: MascotTone = 'info', code?: string): void {
    this.shown.set({ tone, title: this.transloco.translate(TITLE_KEY[tone]), text, code });
    this.open.set(true);
    this.scheduleAutoClose(tone);
  }

  private idleGreeting(): MascotMessage {
    this.transloco.activeLang();
    return {
      tone: 'info',
      title: this.transloco.translate(TITLE_KEY.info),
      text: this.transloco.translate('mascot.idleGreeting.text'),
      code: this.transloco.translate('mascot.idleGreeting.code'),
    };
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
