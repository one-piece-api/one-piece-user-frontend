import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LanguageCatalogService, type LanguageEntry } from '../content/language-catalog';
import { hasErrorCode } from '../shared/http/api-error';
import { MascotService } from '../shared/mascot/mascot';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { LoadingPlaceholder } from '../shared/ui/loading-placeholder';
import { Modal } from '../shared/ui/modal';
import { PageHeader } from '../shared/ui/page-header';

const LANGUAGES_ENDPOINT = '/api/content/languages';

/** Exactly two letters (case-insensitive) - the backend's own `LanguageService` rule (ISO 639-1 style). */
const CODE_PATTERN = /^[a-zA-Z]{2}$/;

const LANGUAGE_ALREADY_EXISTS_ERROR_CODE = 'CONTENT_LANGUAGE_ALREADY_EXISTS';
const INVALID_LANGUAGE_CODE_ERROR_CODE = 'CONTENT_INVALID_LANGUAGE_CODE';
const INVALID_LANGUAGE_NAME_ERROR_CODE = 'CONTENT_INVALID_LANGUAGE_NAME';
const LANGUAGE_IN_USE_ERROR_CODE = 'CONTENT_LANGUAGE_IN_USE';

interface NewLanguageModel {
  code: string;
  name: string;
}

/**
 * "Lingue" (Step 10, docs/user-flows/authentication-and-user-management.md 3.2): the
 * ADMIN-managed language catalog - add/remove a language (a two-letter code plus its full
 * display name, e.g. "en"/"English"), gated on `languages:manage`. Deliberately simpler
 * than "Ruoli & permessi" (RolesPage): a language has two plain attributes, so there is one
 * list and one add/delete flow, not a two-pane matrix. Shares `LanguageCatalogService` with
 * every content screen's tabs, so a change here is visible there the next time one of those
 * components loads.
 */
@Component({
  selector: 'app-languages-page',
  templateUrl: './languages-page.html',
  imports: [Card, PageHeader, Modal, FormField, TranslocoPipe, LoadingPlaceholder],
})
export class LanguagesPage {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);
  protected readonly languageCatalog = inject(LanguageCatalogService);

  protected readonly deletingCode = signal<string | null>(null);
  protected readonly deletePending = signal(false);

  protected readonly modalOpen = signal(false);
  protected readonly modalModel = signal<NewLanguageModel>({ code: '', name: '' });
  protected readonly modalForm = form(this.modalModel, (path) => {
    required(path.code, {
      message: () => this.transloco.translate('languages.newModal.codeRequired'),
    });
    validate(path.code, (ctx) =>
      CODE_PATTERN.test(ctx.value().trim())
        ? null
        : {
            kind: 'invalidCode',
            message: this.transloco.translate('languages.newModal.invalidCode'),
          },
    );
    required(path.name, {
      message: () => this.transloco.translate('languages.newModal.nameRequired'),
    });
  });
  protected readonly modalError = signal<string | null>(null);

  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly secondaryClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');

  protected openModal(): void {
    this.modalForm().reset({ code: '', name: '' });
    this.modalError.set(null);
    this.modalOpen.set(true);
  }

  /** Resets the form here too, not just on open: touched/error state shouldn't outlive a cancel. */
  protected closeModal(): void {
    this.modalOpen.set(false);
    this.modalForm().reset({ code: '', name: '' });
    this.modalError.set(null);
  }

  protected onSubmitModal(event: Event): void {
    event.preventDefault();
    this.modalError.set(null);
    void submit(this.modalForm, async (field) => {
      const code = field().value().code.trim().toLowerCase();
      const name = field().value().name.trim();
      try {
        await firstValueFrom(this.http.post<LanguageEntry>(LANGUAGES_ENDPOINT, { code, name }));
        this.mascotService.show(
          this.transloco.translate('languages.created', { code, name }),
          'success',
        );
        this.languageCatalog.languages.reload();
        this.modalOpen.set(false);
        return null;
      } catch (err) {
        if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, LANGUAGE_ALREADY_EXISTS_ERROR_CODE)
        ) {
          this.modalError.set(
            this.transloco.translate('languages.newModal.alreadyExists', { code }),
          );
        } else if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, INVALID_LANGUAGE_CODE_ERROR_CODE)
        ) {
          this.modalError.set(this.transloco.translate('languages.newModal.invalidCode'));
        } else if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, INVALID_LANGUAGE_NAME_ERROR_CODE)
        ) {
          this.modalError.set(this.transloco.translate('languages.newModal.invalidName'));
        } else {
          this.modalError.set(this.transloco.translate('languages.newModal.genericFailed'));
        }
        return null;
      }
    });
  }

  protected requestDelete(code: string): void {
    this.deletingCode.set(code);
  }

  protected cancelDelete(): void {
    this.deletingCode.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const code = this.deletingCode();
    if (!code) {
      return;
    }
    this.deletePending.set(true);
    try {
      await firstValueFrom(this.http.delete<void>(`${LANGUAGES_ENDPOINT}/${code}`));
      this.mascotService.show(this.transloco.translate('languages.deleted', { code }), 'success');
      this.languageCatalog.languages.reload();
    } catch (err) {
      if (err instanceof HttpErrorResponse && hasErrorCode(err, LANGUAGE_IN_USE_ERROR_CODE)) {
        this.mascotService.show(this.transloco.translate('languages.inUse', { code }), 'error');
      }
      // 401/403/404/5xx already get a themed toast from apiErrorInterceptor.
    } finally {
      // Closed on every outcome, not just success: the dialog's native top layer would
      // otherwise sit in front of the mascot's error toast, hiding it behind a modal the
      // user has no reason to keep open - there's nothing left in it to fix and retry.
      this.deletingCode.set(null);
      this.deletePending.set(false);
    }
  }
}
