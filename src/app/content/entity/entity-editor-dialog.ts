import {
  Component,
  ElementRef,
  Injectable,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CloseButton } from '../../shared/ui/close-button';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import { ENTITY } from './entities';
import type { EntityDraft } from './entity-body';
import type { EntityDefinition } from './entity-definition';
import { EntityEditor } from './entity-editor';

/** One editor to show in a dialog: of which entity, which content - none for a new one - and what it starts with. */
export interface EditorDialogRequest {
  readonly entity: EntityDefinition;
  readonly id?: string;
  readonly preset?: Partial<EntityDraft>;
}

/**
 * Opens the editor of an entity whose definition asks for a dialog (`editor: 'dialog'`) over
 * the page it is opened from, rather than leading to a page of its own: "+ New event" on the
 * list, "Edit" on the detail, "New event with this fruit" on a fruit. One at a time; the
 * dialog itself is placed once, at the root of the app (`EditorDialogHost`).
 */
@Injectable({ providedIn: 'root' })
export class EditorDialogs {
  private readonly current = signal<EditorDialogRequest | null>(null);
  readonly request = this.current.asReadonly();

  open(request: EditorDialogRequest): void {
    this.current.set(request);
  }

  close(): void {
    this.current.set(null);
  }
}

/**
 * The editor in a native `<dialog>` (`showModal()`, like `Modal`): focus trapping, ESC and
 * the backdrop come with the element; every way out closes it. The editor is the page's own
 * (`embedded`), so what it checks, saves and says is the same in both places.
 */
@Component({
  selector: 'app-entity-editor-dialog',
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- backdrop click on the dialog itself; ESC closes it natively -->
    <dialog
      #dialog
      class="m-auto max-h-[92dvh] w-[min(calc(100%-24px),720px)] rounded-2xl border-0 border-t-6 border-t-treasure-500 bg-parchment-100 p-0 shadow-2xl backdrop:bg-ocean-950/40"
      data-testid="editor-dialog"
      (close)="closed.emit()"
      (click)="onBackdropClick($event, dialog)"
    >
      <div class="flex justify-end px-3 pt-3">
        <app-close-button [label]="'ui.modal.close' | transloco" (click)="dialog.close()" />
      </div>
      <div class="px-3 pb-3">
        <!-- Loaded on first open: the dialog sits in the app shell, the editor need not. -->
        @defer {
          <app-entity-editor
            [id]="request().id"
            [preset]="request().preset ?? {}"
            [embedded]="true"
            (finished)="dialog.close()"
          />
        } @loading {
          <app-loading-placeholder [label]="'content.editor.loading' | transloco" />
        }
      </div>
    </dialog>
  `,
  imports: [CloseButton, EntityEditor, LoadingPlaceholder, TranslocoPipe],
  // The editor reads its entity from ENTITY, as on its page: here, the one asked for - read
  // from the service, as a provider is made before the inputs of its component are set.
  viewProviders: [{ provide: ENTITY, useFactory: () => inject(EditorDialogs).request()?.entity }],
})
export class EntityEditorDialog {
  readonly request = input.required<EditorDialogRequest>();
  readonly closed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialogRef().nativeElement.showModal());
  }

  protected onBackdropClick(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) {
      dialog.close();
    }
  }
}

/** Where the editor dialog lives: at the root, so any page can open it. */
@Component({
  selector: 'app-editor-dialog-host',
  template: `
    @if (dialogs.request(); as request) {
      <app-entity-editor-dialog [request]="request" (closed)="dialogs.close()" />
    }
  `,
  imports: [EntityEditorDialog],
})
export class EditorDialogHost {
  protected readonly dialogs = inject(EditorDialogs);
}
