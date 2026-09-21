import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { MascotService } from '../shared/mascot/mascot';
import { Badge } from '../shared/ui/badge';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { LoadingPlaceholder } from '../shared/ui/loading-placeholder';
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
 * UF-CNT-01/02 (docs/user-flows/authentication-and-user-management.md): "Le mie bozze" -
 * every private working revision the caller authored, master-detail (compact scrollable
 * list + detail pane, both visible together, per the reference mockup's structural
 * pattern). No submit/withdraw/approve/publish actions yet - those land in later steps;
 * this screen only ever creates and edits a draft still in `DRAFT`.
 */
@Component({
  selector: 'app-my-drafts',
  templateUrl: './my-drafts.html',
  imports: [Card, Badge, PageHeader, TranslocoPipe, LoadingPlaceholder],
})
export class MyDrafts {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

  protected readonly drafts = httpResource<WorkingRevisionSummary[]>(() => MY_DRAFTS_ENDPOINT);

  protected readonly selectedId = signal<string | null>(null);
  protected readonly detail = httpResource<WorkingRevisionDetail>(() => {
    const id = this.selectedId();
    return id ? `${DRAFTS_ENDPOINT}/${id}` : undefined;
  });

  /**
   * Mobile-only (`lg:` and up ignore this and always show both panes): whether the detail
   * pane currently covers the list instead of sitting beside it. Set alongside
   * `selectedId` whenever a draft is opened, cleared by the "← Elenco" back button.
   */
  protected readonly mobileShowDetail = signal(false);

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly creating = signal(false);
  protected readonly activeLang = signal<LanguageCode>('it');
  protected readonly editModel = signal<EditModel>(emptyEditModel());

  protected readonly languages = LANGUAGES;
  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly secondaryClasses = buttonClasses('secondary');

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
    }
    // 401/403/5xx already get a themed toast from apiErrorInterceptor.
  }
}
