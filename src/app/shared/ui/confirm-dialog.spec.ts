import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ConfirmDialog, type ConfirmTone } from './confirm-dialog';

@Component({
  imports: [ConfirmDialog],
  template: `
    <app-confirm-dialog
      title="Discard the draft?"
      body="It will be lost."
      [note]="note()"
      confirmLabel="Yes, discard"
      [tone]="tone()"
      [open]="open()"
      [busy]="busy()"
      (confirmed)="confirmed = confirmed + 1"
      (cancelled)="cancelled = cancelled + 1; open.set(false)"
    />
  `,
})
class Host {
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly tone = signal<ConfirmTone>('danger');
  readonly note = signal<string | null>('Only the log remains.');
  confirmed = 0;
  cancelled = 0;
}

polyfillDialog();

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function dialog(): HTMLDialogElement {
    return (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(dialog().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    )!;
  }

  function show(): void {
    host.open.set(true);
    fixture.detectChanges();
  }

  it('stays closed until asked, then says what is about to happen', () => {
    expect(dialog().open).toBe(false);

    show();

    expect(dialog().open).toBe(true);
    expect(dialog().querySelector('h2')?.textContent?.trim()).toBe('Discard the draft?');
    expect(dialog().textContent).toContain('It will be lost.');
    expect(dialog().textContent).toContain('Only the log remains.');
  });

  it('leaves the note out when there is none', () => {
    host.note.set(null);
    show();

    expect(dialog().textContent).not.toContain('Only the log remains.');
  });

  it('runs the action from its button, leaving the closing to its owner', () => {
    show();

    button('Yes, discard').click();

    expect(host.confirmed).toBe(1);
    expect(host.cancelled).toBe(0);
  });

  it('counts "Cancel" as cancelling, and closes', () => {
    show();

    button('Cancel').click();
    fixture.detectChanges();

    expect(host.cancelled).toBe(1);
    expect(host.confirmed).toBe(0);
    expect(dialog().open).toBe(false);
  });

  it('counts ESC as cancelling too', () => {
    show();

    dialog().close();

    expect(host.cancelled).toBe(1);
  });

  it('does not count its owner closing it as cancelling', () => {
    show();

    host.open.set(false);
    fixture.detectChanges();

    expect(dialog().open).toBe(false);
    expect(host.cancelled).toBe(0);
  });

  it('holds both buttons while the action is under way', () => {
    show();
    host.busy.set(true);
    fixture.detectChanges();

    expect(button('Cancel').disabled).toBe(true);
    expect(
      dialog().querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')?.disabled,
    ).toBe(true);
    expect(dialog().textContent).toContain('Working…');
  });

  it('paints the action in the color of its tone', () => {
    show();
    const action = () => dialog().querySelector('[data-testid="confirm-action"]')!;

    expect(action().className).toContain('bg-flag-600');
    host.tone.set('primary');
    fixture.detectChanges();
    expect(action().className).toContain('bg-ocean-700');
  });
});
