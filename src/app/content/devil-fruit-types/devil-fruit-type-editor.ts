import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { apiErrorOf } from '../../shared/http/api-error';
import { MascotService } from '../../shared/mascot/mascot';
import { Breadcrumb, type Crumb } from '../../shared/ui/breadcrumb';
import { buttonClasses } from '../../shared/ui/button-variants';
import { Icon } from '../../shared/ui/icon';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import {
  STATUS_LABEL_KEY,
  editableVersion,
  localizedName,
  type Content,
  type Version,
} from '../content.model';
import { discardConfirmation, discardDoneMessage, versionLeftAfterDiscard } from '../discard-draft';
import { LanguageCatalogService } from '../language-catalog';
import {
  ADVANTAGES_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DISADVANTAGES_MAX_LENGTH,
  LONG_TEXT_FIELDS,
  NAME_MAX_LENGTH,
  ROMAJI_MAX_LENGTH,
  draftFieldKey,
  DEVIL_FRUIT_TYPE_ICON,
  draftOf,
  isTranslationComplete,
  namesOf,
  readinessChecks,
  toDevilFruitType,
  type DevilFruitType,
  type DevilFruitTypeDraft,
  type DraftField,
  type LongTextField,
  type TranslationDraft,
} from './devil-fruit-type.model';

const ENDPOINT = '/api/content/devil-fruit-types';
const LIST_ROUTE = '/content/devil-fruit-types';

/** What the backend answers for a content that is not there - or not for this caller. */
const NOT_FOUND_STATUSES = [400, 404];

/** The error codes the editor has something specific to say about. */
const VALUE_ALREADY_USED = 'CONTENT_VALUE_ALREADY_USED';
const VALIDATION_FAILED = 'VALIDATION_FAILED';
const NOT_A_DRAFT = 'CONTENT_VERSION_ACTION_CONFLICT';

/** What is said under a field the backend refused, by error code. */
const FIELD_ERROR_KEY: Record<string, string> = {
  [VALUE_ALREADY_USED]: 'content.editor.error.taken',
  [VALIDATION_FAILED]: 'content.editor.error.tooLong',
};

/** What the Lumacofono says when a save is refused, by error code. */
const SAVE_ERROR_KEY: Record<string, string> = {
  [VALUE_ALREADY_USED]: 'content.editor.takenMessage',
  [VALIDATION_FAILED]: 'content.editor.tooLongMessage',
  [NOT_A_DRAFT]: 'content.editor.notDraftMessage',
};

/** A line of the checklist that is there, and one still to fill in. */
const CHECK_DONE = { classes: 'bg-success-100 text-success-700', mark: '✓' };
const CHECK_MISSING = { classes: 'bg-treasure-100 text-treasure-700', mark: '!' };

const READY_LABEL_KEY: Record<DraftField, string> = {
  romaji: 'content.editor.ready.romaji',
  name: 'content.editor.ready.name',
  description: 'content.editor.ready.description',
  advantages: 'content.editor.ready.advantages',
  disadvantages: 'content.editor.ready.disadvantages',
};

/** The height of each long text box: the description is the longest read. */
const LONG_TEXT_ROWS: Record<LongTextField, number> = {
  description: 8,
  advantages: 5,
  disadvantages: 5,
};

/** One language tab of the editor. */
interface LanguageTab {
  readonly code: string;
  readonly label: string;
  readonly name: string;
  readonly selected: boolean;
  readonly incomplete: boolean;
  readonly refused: boolean;
}

/** One line of "ready for review", ready to render. */
interface CheckView {
  readonly label: string;
  readonly classes: string;
  readonly mark: string;
  readonly noteKey: string;
}

/**
 * The editor of a Devil Fruit Type draft (UF-CNT-01, UF-CNT-02): the romaji, then a name, a
 * description, advantages and disadvantages per language of the catalog, and how far the draft is from being ready for
 * review. Without an id it writes a new content, which is created by its first save; with
 * one it edits the draft the caller may edit - told by the backend, never worked out here.
 * A draft is saved incomplete: the checklist informs, it does not block. The draft can also
 * be discarded (UF-CNT-11), after a confirmation saying what is left once it is gone.
 */
@Component({
  selector: 'app-devil-fruit-type-editor',
  templateUrl: './devil-fruit-type-editor.html',
  imports: [Breadcrumb, ConfirmDialog, Icon, LoadingPlaceholder, RouterLink, TranslocoPipe],
})
export class DevilFruitTypeEditor {
  protected readonly typeIcon = DEVIL_FRUIT_TYPE_ICON;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);
  private readonly languageCatalog = inject(LanguageCatalogService);

  /** Bound by the router: the path's id - absent when a new content is being written. */
  readonly id = input<string>();

  protected readonly isNew = computed(() => this.id() === undefined);

  private readonly content = httpResource<Content>(() => {
    const id = this.id();
    return id ? `${ENDPOINT}/${id}` : undefined;
  });

  /** The version being edited: the one of the chain the backend lets the caller edit. */
  private readonly editable = computed(() =>
    this.content.hasValue() ? editableVersion(this.content.value().versions) : null,
  );

  private readonly versionUrl = computed(() => {
    const editable = this.editable();
    return editable ? `${ENDPOINT}/${this.id()}/versions/${editable.number}` : undefined;
  });
  private readonly version = httpResource<Version<DevilFruitType>>(() => this.versionUrl());

  protected readonly languages = computed(() => this.languageCatalog.languages.value() ?? []);
  private readonly languageCodes = computed(() => this.languages().map(({ code }) => code));

  /** What the editor starts from, once everything it needs has arrived. */
  private readonly saved = computed<DevilFruitTypeDraft | null>(() => {
    if (!this.languageCatalog.languages.hasValue()) {
      return null;
    }
    if (this.isNew()) {
      return draftOf(null, this.languageCodes());
    }
    return this.version.hasValue()
      ? draftOf(this.version.value().body, this.languageCodes())
      : null;
  });

  /** What is being written: starts from what is saved, then follows the keyboard. */
  protected readonly draft = linkedSignal(() => this.saved());

  protected readonly state = computed<'loading' | 'missing' | 'locked' | 'error' | 'ready'>(() => {
    const error =
      this.content.error() ?? this.version.error() ?? this.languageCatalog.languages.error();
    if (error) {
      return isNotFound(error) ? 'missing' : 'error';
    }
    if (this.content.hasValue() && !this.editable()) {
      return 'locked';
    }
    return this.draft() ? 'ready' : 'loading';
  });

  /** The language on screen: the UI's own when the catalog has it, until the editor picks another. */
  protected readonly language = linkedSignal<string | null>(() => {
    const codes = this.languageCodes();
    const uiLanguage = this.transloco.activeLang();
    return codes.includes(uiLanguage) ? uiLanguage : (codes[0] ?? null);
  });
  protected readonly languageLabel = computed(() => this.language()?.toUpperCase() ?? '');

  /** The translation on screen. */
  protected readonly translation = computed<TranslationDraft>(
    () =>
      this.draft()?.translations[this.language() ?? ''] ?? {
        name: '',
        description: '',
        advantages: '',
        disadvantages: '',
      },
  );

  /** The fields the backend refused at the last save, by key (`romaji`, `it.name`), with why. */
  private readonly refusedFields = signal<Record<string, string>>({});
  protected readonly romajiError = computed(() => this.refusedFields()['romaji'] ?? null);
  protected readonly nameError = computed(
    () => this.refusedFields()[`${this.language()}.name`] ?? null,
  );
  /** The long texts of the language on screen, each with why the backend refused it, if it did. */
  protected readonly longTexts = computed(() =>
    LONG_TEXT_FIELDS.map((field) => ({
      field,
      rows: LONG_TEXT_ROWS[field],
      error: this.refusedFields()[`${this.language()}.${field}`] ?? null,
    })),
  );

  protected readonly tabs = computed<LanguageTab[]>(() => {
    const draft = this.draft();
    const refused = Object.keys(this.refusedFields());
    return this.languages().map(({ code, name }) => ({
      code,
      label: code.toUpperCase(),
      name,
      selected: code === this.language(),
      incomplete: !isTranslationComplete(draft?.translations[code]),
      refused: refused.some((key) => key.startsWith(`${code}.`)),
    }));
  });

  /** "Ready for review": the romaji, then every translated field per language. */
  private readonly readiness = computed(() => {
    const draft = this.draft();
    return draft ? readinessChecks(draft, this.languageCodes()) : [];
  });
  protected readonly checks = computed<CheckView[]>(() => {
    this.transloco.activeLang();
    const languageNames = new Map(this.languages().map(({ code, name }) => [code, name]));
    return this.readiness().map((check) => ({
      label: this.transloco.translate(READY_LABEL_KEY[check.field], {
        language: languageNames.get(check.language ?? '') ?? '',
      }),
      ...(check.done ? CHECK_DONE : CHECK_MISSING),
      noteKey: check.done ? 'content.editor.ready.done' : 'content.editor.ready.required',
    }));
  });
  protected readonly readyHintKey = computed(() =>
    this.readiness().every((check) => check.done)
      ? 'content.editor.ready.hintReady'
      : 'content.editor.ready.hintMissing',
  );

  /** What the draft is called while it is written: its name, else its romaji, else "new". */
  protected readonly title = computed(() => {
    const language = this.transloco.activeLang();
    const draft = this.draft();
    if (!draft) {
      return '';
    }
    const written = toDevilFruitType(draft);
    return (
      localizedName(namesOf(written), language) ??
      written.romaji ??
      this.transloco.translate('content.editor.newTitle')
    );
  });

  /** "your draft v3 · v2 stays online", or what a new content is until it is saved. */
  protected readonly subline = computed(() => {
    this.transloco.activeLang();
    const version = this.editable();
    if (!version) {
      return this.transloco.translate('content.editor.sublineNew');
    }
    const online = this.content.value()?.onlineVersionNumber ?? null;
    return online === null
      ? this.transloco.translate('content.editor.subline', { version: version.number })
      : this.transloco.translate('content.editor.sublineOnline', {
          version: version.number,
          online,
        });
  });

  /** What the last review asked to fix, on a draft taken back after a rejection. */
  protected readonly toFix = computed(() =>
    this.version.hasValue() ? this.version.value().rejectionReason : null,
  );

  /** "Editing · Draft". */
  protected readonly badge = computed(() => {
    this.transloco.activeLang();
    const status = this.transloco.translate(STATUS_LABEL_KEY[this.editable()?.status ?? 'DRAFT']);
    return this.transloco.translate('content.editor.badge', { status });
  });

  protected readonly crumbs = computed<Crumb[]>(() => {
    this.transloco.activeLang();
    const crumbs: Crumb[] = [
      { label: this.transloco.translate('content.breadcrumb.contents') },
      {
        label: this.transloco.translate('content.devilFruitTypes.title'),
        icon: DEVIL_FRUIT_TYPE_ICON,
        route: LIST_ROUTE,
      },
    ];
    if (this.isNew()) {
      crumbs.push({ label: this.transloco.translate('content.editor.newTitle') });
    } else {
      crumbs.push(
        {
          label: this.title() || this.transloco.translate('content.detail.crumb'),
          route: this.backRoute(),
        },
        { label: this.transloco.translate('content.editor.crumb'), icon: '✎' },
      );
    }
    return crumbs;
  });

  /** Where leaving the editor leads: the content being edited, or the list for a new one. */
  protected readonly backRoute = computed(() => {
    const id = this.id();
    return id ? `${LIST_ROUTE}/${id}` : LIST_ROUTE;
  });

  protected readonly saving = signal(false);

  /** Discarding is offered when the backend allows it - never for a content not saved yet. */
  protected readonly canDiscard = computed(
    () => this.editable()?.allowedActions.includes('DELETE') ?? false,
  );
  protected readonly confirmingDiscard = signal(false);
  protected readonly discarding = signal(false);

  /** The confirmation, worded for what is left - the same as on a dashboard row. */
  protected readonly discardDialog = computed(() => {
    this.transloco.activeLang();
    const draft = this.editable();
    return discardConfirmation(this.transloco, {
      name: this.title(),
      number: draft?.number ?? 1,
      author: draft?.author.username ?? '',
      override: draft?.overrideActions.includes('DELETE') ?? false,
    });
  });

  protected readonly backButtonClasses = buttonClasses('secondary');
  protected readonly listRoute = LIST_ROUTE;
  protected readonly maxLength = {
    romaji: ROMAJI_MAX_LENGTH,
    name: NAME_MAX_LENGTH,
    description: DESCRIPTION_MAX_LENGTH,
    advantages: ADVANTAGES_MAX_LENGTH,
    disadvantages: DISADVANTAGES_MAX_LENGTH,
  };

  protected setRomaji(romaji: string): void {
    this.draft.update((draft) => draft && { ...draft, romaji });
    this.forgetRefusal('romaji');
  }

  protected setName(name: string): void {
    this.writeTranslation({ name });
    this.forgetRefusal(`${this.language()}.name`);
  }

  protected setLongText(field: LongTextField, text: string): void {
    this.writeTranslation({ [field]: text });
    this.forgetRefusal(`${this.language()}.${field}`);
  }

  /** Saves the draft as it is, complete or not, then goes to the content it belongs to. */
  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.refusedFields.set({});
    try {
      const body = toDevilFruitType(draft);
      const url = this.versionUrl();
      if (url) {
        const saved = await firstValueFrom(this.http.put<Version<DevilFruitType>>(url, body));
        this.mascot.show(this.transloco.translate('content.editor.saved'), 'success');
        await this.router.navigate([this.backRoute()], { queryParams: { v: saved.number } });
      } else {
        const created = await firstValueFrom(this.http.post<Content>(ENDPOINT, body));
        this.mascot.show(this.transloco.translate('content.editor.created'), 'success');
        await this.router.navigate([LIST_ROUTE, created.id]);
      }
    } catch (error) {
      this.onSaveRefused(error);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Removes the draft for good, then leaves for what is left: the content back at its
   * previous version, or the list when the content went with it.
   */
  protected async discard(): Promise<void> {
    const url = this.versionUrl();
    if (!url || this.discarding()) {
      return;
    }
    const number = this.editable()?.number ?? 1;
    this.discarding.set(true);
    try {
      await firstValueFrom(this.http.delete<void>(url));
      this.mascot.show(discardDoneMessage(this.transloco, number), 'success');
      // With nothing left, the content went too: back to the list.
      const leftRoute = versionLeftAfterDiscard(number) === null ? LIST_ROUTE : this.backRoute();
      await this.router.navigate([leftRoute]);
    } catch (error) {
      this.onDiscardRefused(error);
    } finally {
      // Closed on every outcome: the dialog's top layer would otherwise hide the mascot.
      this.confirmingDiscard.set(false);
      this.discarding.set(false);
    }
  }

  /** A 403 or a server failure already got its message from `apiErrorInterceptor`. */
  private onDiscardRefused(error: unknown): void {
    if (!(error instanceof HttpErrorResponse) || error.status === 403 || error.status >= 500) {
      return;
    }
    const messageKey =
      apiErrorOf(error)?.errorCode === NOT_A_DRAFT
        ? 'content.editor.notDraftMessage'
        : 'content.editor.discard.failed';
    this.mascot.show(this.transloco.translate(messageKey), 'error');
  }

  /**
   * Marks the fields the backend named and says why. A 403 or a server failure already got
   * its message from `apiErrorInterceptor`.
   */
  private onSaveRefused(error: unknown): void {
    if (!(error instanceof HttpErrorResponse) || error.status === 403 || error.status >= 500) {
      return;
    }
    const apiError = apiErrorOf(error);
    const errorCode = apiError?.errorCode ?? '';
    const fieldErrorKey = FIELD_ERROR_KEY[errorCode];
    if (fieldErrorKey) {
      const message = this.transloco.translate(fieldErrorKey);
      const refused: Record<string, string> = {};
      for (const violation of apiError?.errors ?? []) {
        const key = draftFieldKey(violation.field);
        if (key) {
          refused[key] = message;
        }
      }
      this.refusedFields.set(refused);
    }
    const messageKey = SAVE_ERROR_KEY[errorCode] ?? 'content.editor.saveFailed';
    this.mascot.show(this.transloco.translate(messageKey), 'error');
  }

  private writeTranslation(change: Partial<TranslationDraft>): void {
    const language = this.language();
    if (!language) {
      return;
    }
    this.draft.update(
      (draft) =>
        draft && {
          ...draft,
          translations: {
            ...draft.translations,
            [language]: { ...draft.translations[language], ...change },
          },
        },
    );
  }

  /** A field being rewritten is no longer the one that was refused. */
  private forgetRefusal(key: string): void {
    this.refusedFields.update((refused) =>
      Object.fromEntries(Object.entries(refused).filter(([field]) => field !== key)),
    );
  }
}

function isNotFound(error: Error): boolean {
  return error instanceof HttpErrorResponse && NOT_FOUND_STATUSES.includes(error.status);
}
