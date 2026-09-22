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
import { PageHeader } from '../shared/ui/page-header';
import {
  LANGUAGES,
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
  imports: [Card, Badge, PageHeader, TranslocoPipe, LoadingPlaceholder],
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

  protected readonly canPublish = computed(() => this.currentUser.hasPermission('content:publish'));
  protected readonly canEdit = computed(() => this.currentUser.hasPermission('content:write'));

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
    } catch (err) {
      this.handlePublishError(err);
    } finally {
      this.publishing.set(false);
    }
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
