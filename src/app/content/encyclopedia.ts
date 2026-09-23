import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
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
  type ContentVersion,
  type ContentVersionDetail,
  type EncyclopediaItem,
  type EncyclopediaItemDetail,
  type LanguageCode,
  type TranslationMap,
  type WorkingRevisionDetail,
} from './devil-fruit-type.model';
import { LanguageCatalogService } from './language-catalog';

const DRAFTS_ENDPOINT = '/api/content/devil-fruit-types';
const ENCYCLOPEDIA_ENDPOINT = '/api/content/encyclopedia';

/**
 * UF-CNT-07/UF-CNT-10 (docs/user-flows/authentication-and-user-management.md):
 * "Enciclopedia" - every item currently `REVIEWED` (awaiting publish), `PUBLISHED`, or
 * `RETIRED`, read-only content, visible to all three content roles via `content:read`.
 * "Pubblica" is rendered only for `content:publish` holders on a `REVIEWED` row, "Ritira"
 * only for the same holders on a `PUBLISHED` row. The entity-type picker the plan
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
  private readonly languageCatalog = inject(LanguageCatalogService);

  protected readonly items = httpResource<EncyclopediaItem[]>(() => ENCYCLOPEDIA_ENDPOINT);

  protected readonly selectedItemId = signal<string | null>(null);
  protected readonly detail = httpResource<EncyclopediaItemDetail>(() => {
    const itemId = this.selectedItemId();
    return itemId ? `${ENCYCLOPEDIA_ENDPOINT}/${itemId}` : undefined;
  });

  /** Mobile-only, same pattern as "Le mie bozze"/"In Revisione" - see those for the rationale. */
  protected readonly mobileShowDetail = signal(false);
  protected readonly activeLang = signal<LanguageCode>('');
  protected readonly publishing = signal(false);
  protected readonly startingEdit = signal(false);

  protected readonly languages = computed(
    () => this.languageCatalog.languages.value()?.map((l) => l.code) ?? [],
  );
  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly secondaryClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');

  protected readonly canPublish = computed(() => this.currentUser.hasPermission('content:publish'));
  protected readonly canEdit = computed(() => this.currentUser.hasPermission('content:write'));

  constructor() {
    // Same "default to the first, re-pick if it disappears" pattern as MyDrafts.
    effect(() => {
      const codes = this.languages();
      if (codes.length === 0) {
        return;
      }
      const current = untracked(() => this.activeLang());
      if (current && codes.includes(current)) {
        return;
      }
      this.activeLang.set(codes[0]);
    });
  }

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

  protected readonly retiring = signal(false);
  protected readonly retireModalOpen = signal(false);

  protected select(itemId: string): void {
    this.selectedItemId.set(itemId);
    this.viewingVersionId.set(null);
    this.mobileShowDetail.set(true);
  }

  /**
   * User-reported gap: "Storico versioni" was a list with no way to see what an older
   * version actually said, only to restore it blind. `null` means "showing the item's
   * current content" (via `detail`); otherwise `versionDetail` supplies it instead.
   */
  protected readonly viewingVersionId = signal<string | null>(null);

  protected readonly versionDetail = httpResource<ContentVersionDetail>(() => {
    const itemId = this.selectedItemId();
    const versionId = this.viewingVersionId();
    return itemId && versionId && this.canPublish()
      ? `${DRAFTS_ENDPOINT}/${itemId}/versions/${versionId}`
      : undefined;
  });

  /** Whichever content is on screen right now - the item's current state, or a past version. */
  protected readonly displayedContent = computed(() => {
    const viewing = this.versionDetail.value();
    if (viewing) {
      return {
        romaji: viewing.romaji,
        translations: viewing.translations,
        sequenceNumber: viewing.sequenceNumber as number | null,
        publisherEmail: viewing.publisherEmail,
      };
    }
    const current = this.detail.value();
    return {
      romaji: current?.romaji ?? null,
      translations: (current?.translations ?? {}) as TranslationMap,
      sequenceNumber: current?.sequenceNumber ?? null,
      publisherEmail: current?.publisherEmail ?? null,
    };
  });

  protected viewVersion(version: ContentVersion): void {
    this.viewingVersionId.set(version.id);
  }

  protected viewCurrent(): void {
    this.viewingVersionId.set(null);
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
      this.viewingVersionId.set(null);
      this.detail.reload();
      this.items.reload();
      this.versions.reload();
    } catch (err) {
      this.handlePublishError(err);
    } finally {
      this.publishing.set(false);
    }
  }

  protected openRetireModal(): void {
    this.retireModalOpen.set(true);
  }

  protected closeRetireModal(): void {
    this.retireModalOpen.set(false);
  }

  /**
   * UF-CNT-10: clears the item's live pointer - it stops being shown as live/public, but
   * its history and any in-progress working revision are untouched; it can return live via
   * a future Publish or Restore.
   */
  protected async confirmRetire(): Promise<void> {
    const itemId = this.detail.value()?.itemId;
    if (!itemId) {
      return;
    }
    this.retiring.set(true);
    try {
      await firstValueFrom(this.http.post(`${DRAFTS_ENDPOINT}/${itemId}/retire`, {}));
      this.mascotService.show(this.transloco.translate('encyclopedia.retired'), 'success');
      this.retireModalOpen.set(false);
      this.viewingVersionId.set(null);
      this.detail.reload();
      this.items.reload();
      this.versions.reload();
    } catch (err) {
      this.handleRetireError(err);
    } finally {
      this.retiring.set(false);
    }
  }

  private handleRetireError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (err.status === 404) {
      this.mascotService.show(this.transloco.translate('encyclopedia.gone'), 'error');
      this.retireModalOpen.set(false);
      this.selectedItemId.set(null);
      this.mobileShowDetail.set(false);
      this.items.reload();
      return;
    }
    this.mascotService.show(this.transloco.translate('encyclopedia.retireError'), 'error');
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
      this.viewingVersionId.set(null);
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
