import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { CurrentUserService } from '../identity/current-user';
import { apiErrorOf } from '../shared/http/api-error';
import { MascotService } from '../shared/mascot/mascot';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { LoadingPlaceholder } from '../shared/ui/loading-placeholder';
import { Modal } from '../shared/ui/modal';
import { PageHeader } from '../shared/ui/page-header';
import {
  LANGUAGES,
  type ContentVersion,
  type EncyclopediaItem,
  type EncyclopediaItemDetail,
  type LanguageCode,
  type WorkingRevisionDetail,
} from './devil-fruit-type.model';

const DRAFTS_ENDPOINT = '/api/content/devil-fruit-types';
const ENCYCLOPEDIA_ENDPOINT = '/api/content/encyclopedia';

/**
 * UF-CNT-07 (docs/user-flows/authentication-and-user-management.md): "Enciclopedia" -
 * every item currently `REVIEWED` (awaiting publish) or `PUBLISHED`, read-only content,
 * visible to all three content roles via `content:read`. "Pubblica" is rendered only for
 * `content:publish` holders on a `REVIEWED` row. The entity-type picker the plan
 * describes is skipped for now, same simplification already made for "Le mie bozze"'s "+
 * Nuova bozza" in Step 1: with only one real entity, there is nothing yet to pick
 * between.
 */
@Component({
  selector: 'app-encyclopedia',
  templateUrl: './encyclopedia.html',
  imports: [Card, Badge, PageHeader, Modal, TranslocoPipe, LoadingPlaceholder],
})
export class Encyclopedia {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly router = inject(Router);

  protected readonly items = httpResource<EncyclopediaItem[]>(() => ENCYCLOPEDIA_ENDPOINT);

  protected readonly selectedItemId = signal<string | null>(null);
  protected readonly detail = httpResource<EncyclopediaItemDetail>(() => {
    const itemId = this.selectedItemId();
    return itemId ? `${ENCYCLOPEDIA_ENDPOINT}/${itemId}` : undefined;
  });

  /** Mobile-only, same pattern as "Le mie bozze"/"In Revisione" - see those for the rationale. */
  protected readonly mobileShowDetail = signal(false);
  protected readonly activeLang = signal<LanguageCode>('it');
  protected readonly publishing = signal(false);
  protected readonly startingEdit = signal(false);

  protected readonly languages = LANGUAGES;
  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly secondaryClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');

  protected readonly canPublish = computed(() => this.currentUser.hasPermission('content:publish'));
  protected readonly canEdit = computed(() => this.currentUser.hasPermission('content:write'));

  /**
   * Step 7's "Storico versioni" - `content:publish` only (flows document 7.7), so a
   * `content:read`-only viewer never even issues the request, not just doesn't see the
   * panel.
   */
  protected readonly versions = httpResource<ContentVersion[]>(() => {
    const itemId = this.selectedItemId();
    return itemId && this.canPublish() ? `${DRAFTS_ENDPOINT}/${itemId}/versions` : undefined;
  });

  protected readonly restoring = signal(false);
  protected readonly restoreModalOpen = signal(false);
  protected readonly restoreTarget = signal<ContentVersion | null>(null);

  protected select(itemId: string): void {
    this.selectedItemId.set(itemId);
    this.mobileShowDetail.set(true);
  }

  protected backToList(): void {
    this.mobileShowDetail.set(false);
  }

  protected setActiveLang(lang: LanguageCode): void {
    this.activeLang.set(lang);
  }

  protected formatPublishedAt(publishedAt: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(publishedAt));
  }

  protected async publish(): Promise<void> {
    const workingRevisionId = this.detail.value()?.workingRevisionId;
    if (!workingRevisionId) {
      return;
    }
    this.publishing.set(true);
    try {
      await firstValueFrom(this.http.post(`${DRAFTS_ENDPOINT}/${workingRevisionId}/publish`, {}));
      this.mascotService.show(this.transloco.translate('encyclopedia.published'), 'success');
      this.detail.reload();
      this.items.reload();
      this.versions.reload();
    } catch (err) {
      this.handlePublishError(err);
    } finally {
      this.publishing.set(false);
    }
  }

  protected openRestoreModal(version: ContentVersion): void {
    this.restoreTarget.set(version);
    this.restoreModalOpen.set(true);
  }

  protected closeRestoreModal(): void {
    this.restoreModalOpen.set(false);
  }

  /**
   * UF-CNT-12: repoints the live pointer straight at an older snapshot -
   * `content:publish` only, no new version row, no review step.
   */
  protected async confirmRestore(): Promise<void> {
    const itemId = this.selectedItemId();
    const target = this.restoreTarget();
    if (!itemId || !target) {
      return;
    }
    this.restoring.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${DRAFTS_ENDPOINT}/${itemId}/versions/${target.id}/restore`, {}),
      );
      this.mascotService.show(
        this.transloco.translate('encyclopedia.versionHistory.restored'),
        'success',
      );
      this.restoreModalOpen.set(false);
      this.detail.reload();
      this.items.reload();
      this.versions.reload();
    } catch (err) {
      this.handleRestoreError(err);
    } finally {
      this.restoring.set(false);
    }
  }

  private handleRestoreError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (err.status === 404) {
      this.mascotService.show(this.transloco.translate('encyclopedia.gone'), 'error');
      this.restoreModalOpen.set(false);
      this.selectedItemId.set(null);
      this.mobileShowDetail.set(false);
      this.items.reload();
      return;
    }
    this.mascotService.show(
      this.transloco.translate('encyclopedia.versionHistory.restoreError'),
      'error',
    );
  }

  /**
   * UF-CNT-08: opens a new, independent draft pre-filled from the live snapshot, then
   * hands off to "Le mie bozze" where the rest of the editing flow already lives - this
   * screen never edits published content directly.
   */
  protected async startEdit(): Promise<void> {
    const itemId = this.detail.value()?.itemId;
    if (!itemId) {
      return;
    }
    this.startingEdit.set(true);
    try {
      const created = await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${itemId}/edit`, {}),
      );
      this.mascotService.show(this.transloco.translate('encyclopedia.editStarted'), 'success');
      await this.router.navigate(['/drafts'], { queryParams: { open: created.id } });
    } catch (err) {
      this.handleEditError(err);
    } finally {
      this.startingEdit.set(false);
    }
  }

  private handleEditError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.mascotService.show(this.transloco.translate('encyclopedia.gone'), 'error');
      this.selectedItemId.set(null);
      this.mobileShowDetail.set(false);
      this.items.reload();
      return;
    }
    this.mascotService.show(this.transloco.translate('encyclopedia.editError'), 'error');
  }

  private handlePublishError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (err.status === 404) {
      this.mascotService.show(this.transloco.translate('encyclopedia.gone'), 'error');
      this.selectedItemId.set(null);
      this.mobileShowDetail.set(false);
      this.items.reload();
      return;
    }
    if (err.status === 409 && apiErrorOf(err)?.errorCode === 'CONTENT_INVALID_STATUS_TRANSITION') {
      this.mascotService.show(this.transloco.translate('encyclopedia.statusChanged'), 'error');
      this.detail.reload();
      this.items.reload();
      return;
    }
    this.mascotService.show(this.transloco.translate('encyclopedia.publishError'), 'error');
  }
}
