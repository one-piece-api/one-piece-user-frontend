import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** `tip` is the mascot's own contextual hint; the others answer something the user did. */
export type MascotTone = 'tip' | 'info' | 'success' | 'error';

export interface MascotMessage {
  readonly tone: MascotTone;
  readonly title: string;
  readonly text: string;
  readonly code?: string;
}

const TITLE_KEY: Record<MascotTone, string> = {
  tip: 'mascot.title.info',
  info: 'mascot.title.info',
  success: 'mascot.title.success',
  error: 'mascot.title.error',
};

/** How long a message stays open on its own: an error, usually longer to read, a bit more. */
const AUTO_DISMISS_MS: Record<MascotTone, number> = {
  tip: 9000,
  info: 9000,
  success: 9000,
  error: 15000,
};

/**
 * The Den Den Mushi: a single-message assistant bubble, not a stack - the latest message
 * always replaces whatever came before it, same as the reference mockup's mascot. Every
 * message closes itself after a while, but never while the user holds it (pointer or focus
 * on the bubble); the launcher brings back the last one.
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

  /**
   * A tip never pushes aside a message the user is still reading: it waits for the next turn
   * while anything but another tip is open.
   */
  showTip(text: string, code?: string): void {
    if (this.open() && this.message().tone !== 'tip') {
      return;
    }
    this.show(text, 'tip', code);
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

  /** The user is reading (pointer or focus on the bubble): it does not close under them. */
  hold(): void {
    clearTimeout(this.dismissTimer);
  }

  /** Once let go, the message gets its full time again. */
  release(): void {
    if (this.open()) {
      this.scheduleAutoClose(this.message().tone);
    }
  }

  private scheduleAutoClose(tone: MascotTone): void {
    clearTimeout(this.dismissTimer);
    this.dismissTimer = setTimeout(() => this.open.set(false), AUTO_DISMISS_MS[tone]);
  }
}
