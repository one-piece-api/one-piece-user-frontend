import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { apiErrorOf } from '../shared/http/api-error';
import { MascotService } from '../shared/mascot/mascot';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { LoadingPlaceholder } from '../shared/ui/loading-placeholder';
import { Modal } from '../shared/ui/modal';
import { PageHeader } from '../shared/ui/page-header';
import {
  EMPTY_TRANSLATION,
  LANGUAGES,
  type LanguageCode,
  type Translation,
  type UpdateDraftRequest,
  type WorkingRevisionDetail,
  type WorkingRevisionSummary,
} from './devil-fruit-type.model';

const DRAFTS_ENDPOINT = '/api/content/devil-fruit-types';
const MY_DRAFTS_ENDPOINT = '/api/content/my-drafts';

interface EditModel {
  romaji: string;
  translations: Record<LanguageCode, Translation>;
}

function emptyEditModel(): EditModel {
  return {
    romaji: '',
    translations: { it: { ...EMPTY_TRANSLATION }, en: { ...EMPTY_TRANSLATION } },
  };
}

/**
 * UF-CNT-01/02/03/04 (docs/user-flows/authentication-and-user-management.md): "Le mie
 * bozze" - every private working revision the caller authored, master-detail (compact
 * scrollable list + detail pane, both visible together, per the reference mockup's
 * structural pattern). Create/edit a `DRAFT`, submit it for review, or withdraw an
 * `IN_REVIEW` revision back to `DRAFT`. No approve/publish actions yet - those land in
 * later steps. A `?open=<id>` query param (set by Enciclopedia's "Modifica" on a
 * Published item, UF-CNT-08) pre-selects that draft on arrival.
 */
@Component({
  selector: 'app-my-drafts',
  templateUrl: './my-drafts.html',
  imports: [Card, Badge, PageHeader, Modal, TranslocoPipe, LoadingPlaceholder],
})
export class MyDrafts {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);

  protected readonly drafts = httpResource<WorkingRevisionSummary[]>(() => MY_DRAFTS_ENDPOINT);

  private readonly openedFromQueryParam = this.route.snapshot.queryParamMap.get('open');
  protected readonly selectedId = signal<string | null>(this.openedFromQueryParam);
  protected readonly detail = httpResource<WorkingRevisionDetail>(() => {
    const id = this.selectedId();
    return id ? `${DRAFTS_ENDPOINT}/${id}` : undefined;
  });

  /**
   * Mobile-only (`lg:` and up ignore this and always show both panes): whether the detail
   * pane currently covers the list instead of sitting beside it. Set alongside
   * `selectedId` whenever a draft is opened, cleared by the "← Elenco" back button.
   */
  protected readonly mobileShowDetail = signal(this.openedFromQueryParam !== null);

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly creating = signal(false);
  protected readonly submitting = signal(false);
  protected readonly withdrawing = signal(false);
  protected readonly activeLang = signal<LanguageCode>('it');
  protected readonly editModel = signal<EditModel>(emptyEditModel());

  protected readonly deleting = signal(false);
  protected readonly deleteModalOpen = signal(false);

  protected readonly languages = LANGUAGES;
  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly secondaryClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');

  protected async createDraft(): Promise<void> {
    this.creating.set(true);
    try {
      const created = await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(DRAFTS_ENDPOINT, {}),
      );
      this.drafts.reload();
      this.selectedId.set(created.id);
      this.mobileShowDetail.set(true);
      this.startEdit(created);
      this.mascotService.show(this.transloco.translate('drafts.created'), 'info');
    } catch {
      this.mascotService.show(this.transloco.translate('drafts.createError'), 'error');
    } finally {
      this.creating.set(false);
    }
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.editing.set(false);
    this.mobileShowDetail.set(true);
  }

  /** Mobile-only back-to-list; `selectedId` stays set so the desktop layout is unaffected. */
  protected backToList(): void {
    this.mobileShowDetail.set(false);
  }

  protected setActiveLang(lang: LanguageCode): void {
    this.activeLang.set(lang);
  }

  /** A `DRAFT` with a leftover rejection reason - shown distinctly from an ordinary draft. */
  protected isRejected(status: string, rejectionReason: string | null): boolean {
    return status === 'DRAFT' && !!rejectionReason;
  }

  protected startEdit(current?: WorkingRevisionDetail): void {
    const source = current ?? this.detail.value();
    if (!source) {
      return;
    }
    this.editModel.set({
      romaji: source.romaji ?? '',
      translations: {
        it: { ...EMPTY_TRANSLATION, ...source.translations.it },
        en: { ...EMPTY_TRANSLATION, ...source.translations.en },
      },
    });
    this.activeLang.set('it');
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected setRomaji(value: string): void {
    this.editModel.update((current) => ({ ...current, romaji: value }));
  }

  protected setField(lang: LanguageCode, field: 'name' | 'description', value: string): void {
    this.editModel.update((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [lang]: { ...current.translations[lang], [field]: value },
      },
    }));
  }

  protected async saveEdit(): Promise<void> {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.saving.set(true);
    const model = this.editModel();
    const request: UpdateDraftRequest = { romaji: model.romaji, translations: model.translations };
    try {
      await firstValueFrom(
        this.http.put<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${id}`, request),
      );
      this.mascotService.show(this.transloco.translate('drafts.saved'), 'success');
      this.editing.set(false);
      this.detail.reload();
      this.drafts.reload();
    } catch (err) {
      this.handleSaveError(err);
    } finally {
      this.saving.set(false);
    }
  }

  private handleSaveError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.mascotService.show(this.transloco.translate('drafts.gone'), 'error');
      this.selectedId.set(null);
      this.editing.set(false);
      this.drafts.reload();
      return;
    }
    if (err instanceof HttpErrorResponse && err.status === 422) {
      this.mascotService.show(this.transloco.translate('drafts.saveError'), 'error');
      return;
    }
    if (err instanceof HttpErrorResponse && err.status === 409) {
      this.mascotService.show(this.transloco.translate('drafts.statusChanged'), 'error');
      this.editing.set(false);
      this.detail.reload();
      this.drafts.reload();
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
  }

  protected async submitForReview(): Promise<void> {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.submitting.set(true);
    try {
      await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${id}/submit`, {}),
      );
      this.mascotService.show(this.transloco.translate('drafts.submitted'), 'success');
      this.detail.reload();
      this.drafts.reload();
    } catch (err) {
      this.handleSubmitError(err);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async withdrawToDraft(): Promise<void> {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.withdrawing.set(true);
    try {
      await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${id}/withdraw`, {}),
      );
      this.mascotService.show(this.transloco.translate('drafts.withdrawn'), 'info');
      this.detail.reload();
      this.drafts.reload();
    } catch (err) {
      this.handleWithdrawError(err);
    } finally {
      this.withdrawing.set(false);
    }
  }

  protected openDeleteModal(): void {
    this.deleteModalOpen.set(true);
  }

  protected closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
  }

  /**
   * UF-CNT-11: permanently removes the caller's own working revision - only reachable
   * while the item has never been published (`d.everPublished` gates the button itself),
   * so a 409 here means the item was published by someone else between the page loading
   * and this click.
   */
  protected async confirmDelete(): Promise<void> {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.deleting.set(true);
    try {
      await firstValueFrom(this.http.delete(`${DRAFTS_ENDPOINT}/${id}`));
      this.mascotService.show(this.transloco.translate('drafts.deleted'), 'success');
      this.deleteModalOpen.set(false);
      this.selectedId.set(null);
      this.mobileShowDetail.set(false);
      this.drafts.reload();
    } catch (err) {
      this.handleDeleteError(err);
    } finally {
      this.deleting.set(false);
    }
  }

  private handleDeleteError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (err.status === 404) {
      this.mascotService.show(this.transloco.translate('drafts.gone'), 'error');
      this.deleteModalOpen.set(false);
      this.selectedId.set(null);
      this.mobileShowDetail.set(false);
      this.drafts.reload();
      return;
    }
    if (
      err.status === 409 &&
      apiErrorOf(err)?.errorCode === 'CONTENT_CANNOT_DELETE_PUBLISHED_ITEM'
    ) {
      this.mascotService.show(this.transloco.translate('drafts.deleteBlocked'), 'error');
      this.deleteModalOpen.set(false);
      this.detail.reload();
      return;
    }
    this.mascotService.show(this.transloco.translate('drafts.deleteError'), 'error');
  }

  private handleSubmitError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (err.status === 404) {
      this.mascotService.show(this.transloco.translate('drafts.gone'), 'error');
      this.selectedId.set(null);
      this.drafts.reload();
      return;
    }
    const apiError = apiErrorOf(err);
    if (err.status === 422 && apiError?.errors) {
      const fields = apiError.errors
        .map((violation) => this.describeField(violation.field))
        .join(', ');
      this.mascotService.show(
        this.transloco.translate('drafts.submitIncomplete', { fields }),
        'error',
      );
      return;
    }
    if (err.status === 409 && apiError?.errorCode === 'CONTENT_REVIEW_SLOT_OCCUPIED') {
      this.mascotService.show(this.transloco.translate('drafts.submitSlotOccupied'), 'error');
      return;
    }
    if (err.status === 409 && apiError?.errorCode === 'CONTENT_INVALID_STATUS_TRANSITION') {
      this.mascotService.show(this.transloco.translate('drafts.statusChanged'), 'error');
      this.detail.reload();
      this.drafts.reload();
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
  }

  private handleWithdrawError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (err.status === 404) {
      this.mascotService.show(this.transloco.translate('drafts.gone'), 'error');
      this.selectedId.set(null);
      this.drafts.reload();
      return;
    }
    const errorCode = apiErrorOf(err)?.errorCode;
    if (err.status === 409 && errorCode === 'CONTENT_REVIEW_ALREADY_CLAIMED') {
      this.mascotService.show(this.transloco.translate('drafts.withdrawClaimed'), 'error');
      this.detail.reload();
      this.drafts.reload();
      return;
    }
    if (err.status === 409 && errorCode === 'CONTENT_INVALID_STATUS_TRANSITION') {
      this.mascotService.show(this.transloco.translate('drafts.statusChanged'), 'error');
      this.detail.reload();
      this.drafts.reload();
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
  }

  /** Turns a backend field path ("translations.en.name") into a label the mascot can list. */
  private describeField(field: string): string {
    if (field === 'romaji') {
      return this.transloco.translate('drafts.romaji');
    }
    const match = /^translations\.(\w+)\.(name|description)$/.exec(field);
    if (!match) {
      return field;
    }
    const [, lang, property] = match;
    return `${lang.toUpperCase()} · ${this.transloco.translate(`drafts.${property}`)}`;
  }
}
