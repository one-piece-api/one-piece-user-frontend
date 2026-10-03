import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MascotService } from '../shared/mascot/mascot';
import { polyfillDialog } from '../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { RejectDialog } from './reject-dialog';

@Component({
  imports: [RejectDialog],
  template: `
    <app-reject-dialog
      target="Logia · Devil Fruit Type by nami"
      [open]="open()"
      [busy]="busy()"
      (confirmed)="reasons.push($event)"
      (cancelled)="cancelled = cancelled + 1; open.set(false)"
    />
  `,
})
class Host {
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly reasons: string[] = [];
  cancelled = 0;
}

polyfillDialog();

describe('RejectDialog', () => {
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

  function byTestId<T extends HTMLElement>(id: string): T {
    return dialog().querySelector<T>(`[data-testid="${id}"]`)!;
  }

  function show(): void {
    host.open.set(true);
    fixture.detectChanges();
  }

  function write(reason: string): void {
    const textarea = byTestId<HTMLTextAreaElement>('reject-reason');
    textarea.value = reason;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function reject(): void {
    byTestId<HTMLButtonElement>('reject-action').click();
    fixture.detectChanges();
  }

  it('opens on what is being rejected, with an empty reason and its counter', () => {
    expect(dialog().open).toBe(false);

    show();

    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain('Reject this review?');
    expect(dialog().textContent).toContain('Logia · Devil Fruit Type by nami');
    expect(byTestId('reject-hint').textContent).toContain('(0/8 characters)');
  });

  it('counts the reason without the space around it', () => {
    show();

    write('   short   ');

    expect(byTestId('reject-hint').textContent).toContain('(5/8 characters)');
  });

  it('does not send a reason too short: the field turns red and the mascot says why', () => {
    show();
    write('Too few');

    reject();

    expect(host.reasons).toEqual([]);
    expect(byTestId('reject-reason').getAttribute('aria-invalid')).toBe('true');
    expect(TestBed.inject(MascotService).message()).toEqual(
      expect.objectContaining({ tone: 'error', text: expect.stringContaining('at least one') }),
    );
  });

  it('sends the reason without the space around it once it is long enough', () => {
    show();
    write('  Missing a source for the name \n');

    expect(byTestId('reject-hint').textContent).toContain('Reason ready');
    reject();

    expect(host.reasons).toEqual(['Missing a source for the name']);
  });

  it('starts empty again every time it opens', () => {
    show();
    write('Missing a source');
    dialog().close();
    fixture.detectChanges();

    show();

    expect(byTestId<HTMLTextAreaElement>('reject-reason').value).toBe('');
    expect(host.cancelled).toBe(1);
  });

  it('waits while the rejection is under way', () => {
    show();
    host.busy.set(true);
    fixture.detectChanges();

    expect(byTestId<HTMLButtonElement>('reject-action').disabled).toBe(true);
    expect(byTestId('reject-action').textContent?.trim()).toBe('Working…');
  });
});
