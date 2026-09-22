import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
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
  type LanguageCode,
  type ReviewQueueItem,
  type WorkingRevisionDetail,
} from './devil-fruit-type.model';
import { LanguageCatalogService } from './language-catalog';

const DRAFTS_ENDPOINT = '/api/content/devil-fruit-types';
const REVIEW_QUEUE_ENDPOINT = '/api/content/review-queue';

/**
 * UF-CNT-05/06/13/14 (docs/user-flows/authentication-and-user-management.md): the shared
 * "In Revisione" queue - every author's `IN_REVIEW` work, master-detail like "Le mie
 * bozze" but read-only content (a REVIEWER judges, never edits). Claim/release are
 * available to any REVIEWER; approve/reject only to whoever currently holds the claim -
 * everyone else sees who does instead of the action buttons.
 */
@Component({
  selector: 'app-review-queue',
  templateUrl: './review-queue.html',
  imports: [Card, Badge, PageHeader, Modal, TranslocoPipe, LoadingPlaceholder],
})
export class ReviewQueue {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly languageCatalog = inject(LanguageCatalogService);

  protected readonly queue = httpResource<ReviewQueueItem[]>(() => REVIEW_QUEUE_ENDPOINT);

  protected readonly selectedId = signal<string | null>(null);
  protected readonly detail = httpResource<WorkingRevisionDetail>(() => {
    const id = this.selectedId();
    return id ? `${REVIEW_QUEUE_ENDPOINT}/${id}` : undefined;
  });

  /** Mobile-only, same pattern as "Le mie bozze" - see that component for the rationale. */
  protected readonly mobileShowDetail = signal(false);
  protected readonly activeLang = signal<LanguageCode>('');

  protected readonly claiming = signal(false);
  protected readonly releasing = signal(false);
  protected readonly approving = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly rejectModalOpen = signal(false);
  protected readonly rejectReason = signal('');

  protected readonly languages = computed(
    () => this.languageCatalog.languages.value()?.map((l) => l.code) ?? [],
  );
  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly secondaryClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');

  protected readonly isClaimedByMe = computed(() => {
    const email = this.currentUser.me.value()?.email;
    return !!email && this.detail.value()?.claimedByEmail === email;
  });

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

  protected select(id: string): void {
    this.selectedId.set(id);
    this.mobileShowDetail.set(true);
  }

  protected backToList(): void {
    this.mobileShowDetail.set(false);
  }

  protected setActiveLang(lang: LanguageCode): void {
    this.activeLang.set(lang);
  }

  protected formatUpdatedAt(updatedAt: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(updatedAt));
  }

  protected async claim(): Promise<void> {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.claiming.set(true);
    try {
      await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${id}/claim`, {}),
      );
      this.mascotService.show(this.transloco.translate('reviewQueue.claimed'), 'success');
      this.refresh();
    } catch (err) {
      this.handleActionError(err, 'reviewQueue.claimError', 'reviewQueue.alreadyClaimed');
    } finally {
      this.claiming.set(false);
    }
  }

  protected async release(): Promise<void> {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.releasing.set(true);
    try {
      await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${id}/release`, {}),
      );
      this.mascotService.show(this.transloco.translate('reviewQueue.released'), 'info');
      this.refresh();
    } catch (err) {
      this.handleActionError(err, 'reviewQueue.releaseError');
    } finally {
      this.releasing.set(false);
    }
  }

  protected async approve(): Promise<void> {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.approving.set(true);
    try {
      await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${id}/approve`, {}),
      );
      this.mascotService.show(this.transloco.translate('reviewQueue.approved'), 'success');
      this.selectedId.set(null);
      this.mobileShowDetail.set(false);
      this.queue.reload();
    } catch (err) {
      this.handleActionError(err, 'reviewQueue.approveError');
    } finally {
      this.approving.set(false);
    }
  }

  protected openRejectModal(): void {
    this.rejectReason.set('');
    this.rejectModalOpen.set(true);
  }

  protected closeRejectModal(): void {
    this.rejectModalOpen.set(false);
  }

  protected setRejectReason(value: string): void {
    this.rejectReason.set(value);
  }

  protected async confirmReject(): Promise<void> {
    const id = this.selectedId();
    const reason = this.rejectReason().trim();
    if (!id || !reason) {
      return;
    }
    this.rejecting.set(true);
    try {
      await firstValueFrom(
        this.http.post<WorkingRevisionDetail>(`${DRAFTS_ENDPOINT}/${id}/reject`, { reason }),
      );
      this.mascotService.show(this.transloco.translate('reviewQueue.rejected'), 'info');
      this.rejectModalOpen.set(false);
      this.selectedId.set(null);
      this.mobileShowDetail.set(false);
      this.queue.reload();
    } catch (err) {
      this.handleActionError(err, 'reviewQueue.rejectError');
    } finally {
      this.rejecting.set(false);
    }
  }

  private refresh(): void {
    this.detail.reload();
    this.queue.reload();
  }

  private handleActionError(err: unknown, fallbackKey: string, conflictKey?: string): void {
    if (!(err instanceof HttpErrorResponse)) {
      return;
    }
    if (err.status === 404) {
      this.mascotService.show(this.transloco.translate('reviewQueue.gone'), 'error');
      this.selectedId.set(null);
      this.mobileShowDetail.set(false);
      this.queue.reload();
      return;
    }
    const errorCode = apiErrorOf(err)?.errorCode;
    if (err.status === 409 && errorCode === 'CONTENT_REVIEW_ALREADY_CLAIMED' && conflictKey) {
      this.mascotService.show(this.transloco.translate(conflictKey), 'error');
      this.refresh();
      return;
    }
    if (
      err.status === 409 &&
      (errorCode === 'CONTENT_NOT_CLAIMANT' || errorCode === 'CONTENT_INVALID_STATUS_TRANSITION')
    ) {
      this.mascotService.show(this.transloco.translate('reviewQueue.staleClaim'), 'error');
      this.refresh();
      return;
    }
    this.mascotService.show(this.transloco.translate(fallbackKey), 'error');
  }
}
