import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
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
import { contentsCrumb } from '../content-crumbs';
import {
  STATUS_LABEL_KEY,
  editableVersion,
  localizedName,
  type Content,
  type Version,
} from '../content.model';
import { discardConfirmation, discardDoneMessage, versionLeftAfterDiscard } from '../discard-draft';
import { LanguageCatalogService } from '../language-catalog';
import { refusedSlug } from '../version-transition';
import { ENTITY, entityOf } from './entities';
import {
  draftFieldKey,
  draftOf,
  isLanguageComplete,
  localizedFields,
  namesOf,
  readinessChecks,
  sharedFields,
  toBody,
  uploadOf,
  type EntityBody,
  type EntityDraft,
  type TranslationDraft,
} from './entity-body';
import type { ImageField, SubcategoryField } from './entity-definition';
import { isImageDraft, type ImageDraft } from './entity-image';
import { isReference, type EntityReference } from './entity-reference';
import { textOf } from './field-kinds';
import { ImagePicker } from './image-picker';
import { imageProblemOf, imageProblemWords } from './image-words';
import { RelationPicker } from './relation-picker';
import {
  newSubcategoryKey,
  subcategoryChoices,
  subcategoryLabel,
  subcategoryText,
  type SubcategoryDraft,
  type SubcategoryPart,
} from './entity-subcategory';

/** What the backend answers for a content that is not there - or not for this caller. */
const NOT_FOUND_STATUSES = [400, 404];

/** The error codes the editor has something specific to say about. */
const VALUE_ALREADY_USED = 'CONTENT_VALUE_ALREADY_USED';
const SLUG_ALREADY_USED = 'CONTENT_SLUG_ALREADY_USED';
const VALUE_INVALID = 'CONTENT_VALUE_INVALID';
const VALIDATION_FAILED = 'VALIDATION_FAILED';
const NOT_A_DRAFT = 'CONTENT_VERSION_ACTION_CONFLICT';

/** What is said under a relation the backend refused: the content chosen cannot be linked. */
const RELATION_REFUSED_KEY = 'content.editor.error.notLinkable';
const RELATION_REFUSED_MESSAGE_KEY = 'content.editor.notLinkableMessage';

/** What is said under a subcategory the backend refused, and what the Lumacofono says then. */
const SUBCATEGORY_REFUSED_KEY = {
  picked: 'content.editor.error.subcategoryNotOfType',
  id: 'content.editor.error.subcategoryUnknown',
  name: 'content.editor.error.subcategoryNameTaken',
};
const SUBCATEGORY_REFUSED_MESSAGE_KEY = 'content.editor.subcategoryRefusedMessage';

/** What the Lumacofono says when the image was refused - the reason is under the image. */
const IMAGE_REFUSED_MESSAGE_KEY = 'content.editor.imageRefusedMessage';

/** What is said under a field the backend refused, by error code. */
const FIELD_ERROR_KEY: Record<string, string> = {
  [VALUE_ALREADY_USED]: 'content.editor.error.taken',
  [SLUG_ALREADY_USED]: 'content.editor.error.slugTaken',
  [VALUE_INVALID]: 'content.editor.error.noSlug',
  [VALIDATION_FAILED]: 'content.editor.error.tooLong',
};

/** What the Lumacofono says when a save is refused, by error code. */
const SAVE_ERROR_KEY: Record<string, string> = {
  [VALUE_ALREADY_USED]: 'content.editor.takenMessage',
  [SLUG_ALREADY_USED]: 'content.editor.slugTakenMessage',
  [VALUE_INVALID]: 'content.editor.noSlugMessage',
  [VALIDATION_FAILED]: 'content.editor.tooLongMessage',
  [NOT_A_DRAFT]: 'content.editor.notDraftMessage',
};

/** A line of the checklist that is there, and one still to fill in. */
const CHECK_DONE = { classes: 'bg-success-100 text-success-700', mark: '✓' };
const CHECK_MISSING = { classes: 'bg-treasure-100 text-treasure-700', mark: '!' };

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
 * The editor of a draft of any entity (UF-CNT-01, UF-CNT-02): the fields shared by every
 * language, then the translated ones per language of the catalog, as the definition lists
 * them, and how far the draft is from being ready for review. Without an id it writes a new content, which is created by its first save; with
 * one it edits the draft the caller may edit - told by the backend, never worked out here.
 * A draft is saved incomplete: the checklist informs, it does not block. The draft can also
 * be discarded (UF-CNT-11), after a confirmation saying what is left once it is gone.
 */
@Component({
  selector: 'app-entity-editor',
  templateUrl: './entity-editor.html',
  imports: [
    Breadcrumb,
    ConfirmDialog,
    Icon,
    ImagePicker,
    LoadingPlaceholder,
    RelationPicker,
    RouterLink,
    TranslocoPipe,
  ],
})
export class EntityEditor {
  protected readonly entity = inject(ENTITY);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);
  private readonly languageCatalog = inject(LanguageCatalogService);

  constructor() {
    // A file chosen and never saved is still held by the browser: let it go with the page.
    inject(DestroyRef).onDestroy(() => this.releasePreviews(this.draft()));
  }

  /** Bound by the router: the path's id - absent when a new content is being written. */
  readonly id = input<string>();

  protected readonly isNew = computed(() => this.id() === undefined);

  private readonly content = httpResource<Content>(() => {
    const id = this.id();
    return id ? `${this.entity.api}/${id}` : undefined;
  });

  /** The version being edited: the one of the chain the backend lets the caller edit. */
  private readonly editable = computed(() =>
    this.content.hasValue() ? editableVersion(this.content.value().versions) : null,
  );

  private readonly versionUrl = computed(() => {
    const editable = this.editable();
    return editable ? `${this.entity.api}/${this.id()}/versions/${editable.number}` : undefined;
  });
  private readonly version = httpResource<Version<EntityBody>>(() => this.versionUrl());

  protected readonly languages = computed(() => this.languageCatalog.languages.value() ?? []);
  private readonly languageCodes = computed(() => this.languages().map(({ code }) => code));

  /** What the editor starts from, once everything it needs has arrived. */
  private readonly saved = computed<EntityDraft | null>(() => {
    if (!this.languageCatalog.languages.hasValue()) {
      return null;
    }
    if (this.isNew()) {
      return draftOf(this.entity, null, this.languageCodes());
    }
    return this.version.hasValue()
      ? draftOf(this.entity, this.version.value().body, this.languageCodes())
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

  /** The fields the backend refused at the last save, by key (`romaji`, `it.name`), with why. */
  private readonly refusedFields = signal<Record<string, string>>({});

  /**
   * The fields shared by every language, each with its value and why the backend refused it.
   * A relation's value is the reference chosen, and `source` the section its choices are
   * asked of - `null` where the app has no such section.
   */
  protected readonly sharedViews = computed(() => {
    const draft = this.draft();
    const language = this.transloco.activeLang();
    return (
      sharedFields(this.entity)
        .filter((field) => field.kind !== 'image' && field.kind !== 'subcategoryList')
        .map((field) => {
          const chosen = draft?.[field.key];
          return {
            field,
            value: textOf(chosen),
            reference: isReference(chosen) ? chosen : null,
            source: field.kind === 'relation' ? (entityOf(field.target)?.api ?? null) : null,
            choices:
              field.kind === 'subcategory'
                ? subcategoryChoices(draft?.[field.of]).map((choice) => ({
                    id: choice.id,
                    label: subcategoryLabel(choice, language),
                  }))
                : [],
            error: this.refusedFields()[field.key] ?? null,
          };
        })
        // A subcategory is offered only when the content chosen has some.
        .filter((view) => view.field.kind !== 'subcategory' || view.choices.length > 0)
    );
  });
  /**
   * The image of the draft, when the entity has one - shown beside the other shared fields,
   * as the "Media" area of the mockup - with why the backend refused it.
   */
  protected readonly imageView = computed(() => {
    const field = this.entity.fields.find(
      (candidate): candidate is ImageField => candidate.kind === 'image',
    );
    if (!field) {
      return null;
    }
    const value = this.draft()?.[field.key];
    return {
      field,
      value: isImageDraft(value) ? value : null,
      error: this.refusedFields()[field.key] ?? null,
    };
  });

  /** The translated fields in the language on screen, likewise. */
  protected readonly localizedViews = computed(() => {
    const language = this.language();
    const translation = this.draft()?.translations[language ?? ''];
    return localizedFields(this.entity).map((field) => ({
      field,
      value: textOf(translation?.[field.key]),
      error: this.refusedFields()[`${language}.${field.key}`] ?? null,
    }));
  });

  /**
   * The lists of subcategories, in the language on screen: each one's texts, where it stands
   * and why the backend refused it - its id, or a text in this language.
   */
  protected readonly subcategoryListViews = computed(() => {
    const language = this.language() ?? '';
    const refused = this.refusedFields();
    return this.entity.fields.flatMap((field) => {
      if (field.kind !== 'subcategoryList') {
        return [];
      }
      const entries = this.subcategoriesIn(field.key);
      return [
        {
          field,
          entries: entries.map((subcategory, index) => ({
            key: subcategory.key,
            position: index + 1,
            first: index === 0,
            last: index === entries.length - 1,
            name: subcategoryText(subcategory, language, 'name'),
            description: subcategoryText(subcategory, language, 'description'),
            nameError: refused[`${language}.${field.key}.${index}.name`] ?? null,
            descriptionError: refused[`${language}.${field.key}.${index}.description`] ?? null,
            error: refused[`${field.key}.${index}`] ?? null,
          })),
        },
      ];
    });
  });

  protected readonly tabs = computed<LanguageTab[]>(() => {
    const draft = this.draft();
    const refused = Object.keys(this.refusedFields());
    return this.languages().map(({ code, name }) => ({
      code,
      label: code.toUpperCase(),
      name,
      selected: code === this.language(),
      incomplete: !draft || !isLanguageComplete(this.entity, draft, code),
      refused: refused.some((key) => key.startsWith(`${code}.`)),
    }));
  });

  /** "Ready for review": the romaji, then every translated field per language. */
  private readonly readiness = computed(() => {
    const draft = this.draft();
    return draft ? readinessChecks(this.entity, draft, this.languageCodes()) : [];
  });
  protected readonly checks = computed<CheckView[]>(() => {
    this.transloco.activeLang();
    const languageNames = new Map(this.languages().map(({ code, name }) => [code, name]));
    return this.readiness().map((check) => ({
      label: this.transloco.translate(
        check.entry
          ? `content.editor.ready.${check.field}.${check.entry.part}`
          : `content.editor.ready.${check.field}`,
        {
          language: languageNames.get(check.language ?? '') ?? '',
          position: check.entry?.position,
        },
      ),
      ...(check.done ? CHECK_DONE : CHECK_MISSING),
      noteKey: check.done ? 'content.editor.ready.done' : 'content.editor.ready.required',
    }));
  });
  protected readonly readyHintKey = computed(() =>
    this.readiness().every((check) => check.done)
      ? 'content.editor.ready.hintReady'
      : `${this.entity.i18n}.hintMissing`,
  );

  /** What the draft is called while it is written: its name, else its romaji, else "new". */
  protected readonly title = computed(() => {
    const language = this.transloco.activeLang();
    const draft = this.draft();
    if (!draft) {
      return '';
    }
    const written = toBody(this.entity, draft);
    return (
      localizedName(namesOf(written), language) ??
      written.romaji ??
      this.transloco.translate(`${this.entity.i18n}.newTitle`)
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
      contentsCrumb(this.transloco),
      { label: this.transloco.translate(`${this.entity.i18n}.title`), route: this.entity.route },
    ];
    if (this.isNew()) {
      crumbs.push({ label: this.transloco.translate(`${this.entity.i18n}.newTitle`) });
    } else {
      crumbs.push(
        {
          label: this.title() || this.transloco.translate('content.detail.crumb'),
          route: this.backRoute(),
        },
        { label: this.transloco.translate('content.editor.crumb') },
      );
    }
    return crumbs;
  });

  /** Where leaving the editor leads: the content being edited, or the list for a new one. */
  protected readonly backRoute = computed(() => {
    const id = this.id();
    return id ? `${this.entity.route}/${id}` : this.entity.route;
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
  protected readonly listRoute = this.entity.route;
  /** Writes a field shared by every language. */
  protected setShared(key: string, value: string): void {
    this.draft.update((draft) => draft && { ...draft, [key]: value });
    this.forgetRefusal(key);
  }

  /** Chooses the content a relation points to - or none. */
  protected setRelation(key: string, reference: EntityReference | null): void {
    const before = this.draft()?.[key];
    const changed = (isReference(before) ? before.id : null) !== (reference?.id ?? null);
    // The subcategories of the content left behind are not this one's to offer.
    const cleared = changed
      ? Object.fromEntries(this.subcategoryFieldsOf(key).map((field) => [field.key, null]))
      : {};
    this.draft.update((draft) => draft && { ...draft, [key]: reference, ...cleared });
    [key, ...Object.keys(cleared)].forEach((field) => this.forgetRefusal(field));
  }

  /** Picks one of the subcategories the related content offers - or none, for an empty id. */
  protected setSubcategory(field: SubcategoryField, id: string): void {
    const choice = subcategoryChoices(this.draft()?.[field.of]).find(
      (candidate) => candidate.id === id,
    );
    this.draft.update((draft) => draft && { ...draft, [field.key]: choice ?? null });
    this.forgetRefusal(field.key);
  }

  /** Adds an empty subcategory at the end of the list: the backend gives its id at the save. */
  protected addSubcategory(key: string): void {
    const added: SubcategoryDraft = { id: null, key: newSubcategoryKey(), translations: {} };
    this.writeSubcategories(key, [...this.subcategoriesIn(key), added]);
  }

  /** Removes a subcategory: a version that leaves it out no longer has it. */
  protected removeSubcategory(key: string, index: number): void {
    this.writeSubcategories(
      key,
      this.subcategoriesIn(key).filter((_, position) => position !== index),
    );
    this.forgetRefusalsOf(key);
  }

  /** Moves a subcategory one place up (-1) or down (+1): the order is the display order. */
  protected moveSubcategory(key: string, index: number, step: -1 | 1): void {
    const entries = [...this.subcategoriesIn(key)];
    const target = index + step;
    if (target < 0 || target >= entries.length) {
      return;
    }
    [entries[index], entries[target]] = [entries[target], entries[index]];
    this.writeSubcategories(key, entries);
    this.forgetRefusalsOf(key);
  }

  /** Writes a subcategory's name or description, in the language on screen. */
  protected setSubcategoryText(
    key: string,
    index: number,
    part: SubcategoryPart,
    value: string,
  ): void {
    const language = this.language();
    if (!language) {
      return;
    }
    this.writeSubcategories(
      key,
      this.subcategoriesIn(key).map((subcategory, position) =>
        position === index
          ? {
              ...subcategory,
              translations: {
                ...subcategory.translations,
                [language]: { ...subcategory.translations[language], [part]: value },
              },
            }
          : subcategory,
      ),
    );
    this.forgetRefusal(`${language}.${key}.${index}.${part}`);
  }

  /**
   * Chooses the image of the draft - a file already checked by the picker - or none. The
   * file is shown from an object URL until it is saved; the one it replaces is let go.
   */
  protected setImage(key: string, file: File | null): void {
    const previous = this.draft()?.[key];
    const image: ImageDraft | null = file
      ? { chosen: file, preview: URL.createObjectURL(file) }
      : null;
    this.draft.update((draft) => draft && { ...draft, [key]: image });
    this.releasePreview(previous);
    this.forgetRefusal(key);
  }

  /** Writes a translated field, in the language on screen. */
  protected setLocalized(key: string, value: string): void {
    this.writeTranslation({ [key]: value });
    this.forgetRefusal(`${this.language()}.${key}`);
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
      const request = this.requestOf(draft);
      const url = this.versionUrl();
      if (url) {
        const saved = await firstValueFrom(this.http.put<Version<EntityBody>>(url, request));
        this.mascot.show(this.transloco.translate('content.editor.saved'), 'success');
        await this.router.navigate([this.backRoute()], { queryParams: { v: saved.number } });
      } else {
        const created = await firstValueFrom(this.http.post<Content>(this.entity.api, request));
        this.mascot.show(this.transloco.translate('content.editor.created'), 'success');
        await this.router.navigate([this.entity.route, created.id]);
      }
    } catch (error) {
      this.onSaveRefused(error);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * What a save sends: the JSON alone, or - with a file chosen - a multipart form with the
   * JSON as its `version` part and the file beside it (plan D5). Keeping or removing an image
   * needs no file: `uploadOf` says it in the JSON.
   */
  private requestOf(draft: EntityDraft): EntityBody | FormData {
    const saved = this.version.hasValue() ? this.version.value().body : null;
    const { body, file } = uploadOf(this.entity, draft, saved);
    if (!file) {
      return body;
    }
    const form = new FormData();
    form.append('version', new Blob([JSON.stringify(body)], { type: 'application/json' }));
    form.append(file.part, file.file, file.file.name);
    return form;
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
      const leftRoute =
        versionLeftAfterDiscard(number) === null ? this.entity.route : this.backRoute();
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
    const image = this.imageView();
    const imageProblem = imageProblemOf(error);
    if (image && imageProblem) {
      this.refusedFields.set({
        [image.field.key]: imageProblemWords(this.transloco, imageProblem),
      });
      this.mascot.show(this.transloco.translate(IMAGE_REFUSED_MESSAGE_KEY), 'error');
      return;
    }
    const apiError = apiErrorOf(error);
    const errorCode = apiError?.errorCode ?? '';
    const fieldErrorKey = FIELD_ERROR_KEY[errorCode];
    let relationRefused = false;
    let subcategoryRefused = false;
    if (fieldErrorKey) {
      const refused: Record<string, string> = {};
      for (const violation of apiError?.errors ?? []) {
        const key = draftFieldKey(this.entity, violation.field);
        if (key) {
          // A relation or a subcategory is refused for being invalid: not for a slug, which
          // says the same code.
          const invalid = errorCode === VALUE_INVALID ? this.invalidValueKey(key) : null;
          relationRefused ||= invalid === RELATION_REFUSED_KEY;
          subcategoryRefused ||= invalid !== null && invalid !== RELATION_REFUSED_KEY;
          refused[key] = this.transloco.translate(invalid ?? fieldErrorKey);
        }
      }
      this.refusedFields.set(refused);
    }
    const messageKey = relationRefused
      ? RELATION_REFUSED_MESSAGE_KEY
      : subcategoryRefused
        ? SUBCATEGORY_REFUSED_MESSAGE_KEY
        : (SAVE_ERROR_KEY[errorCode] ?? 'content.editor.saveFailed');
    this.mascot.show(this.transloco.translate(messageKey, { slug: refusedSlug(error) }), 'error');
  }

  /**
   * What is said under a field refused as invalid, when it is not the romaji's slug: a
   * relation that cannot be linked, a subcategory not of the chosen content, a subcategory id
   * the draft does not have, or a name another subcategory has. `null` for the romaji.
   */
  private invalidValueKey(key: string): string | null {
    const field = this.entity.fields.find((candidate) => candidate.key === key);
    if (field?.kind === 'relation') {
      return RELATION_REFUSED_KEY;
    }
    if (field?.kind === 'subcategory') {
      return SUBCATEGORY_REFUSED_KEY.picked;
    }
    const lists = this.entity.fields.filter(({ kind }) => kind === 'subcategoryList');
    const [first, second] = key.split('.');
    if (lists.some((list) => list.key === first)) {
      return SUBCATEGORY_REFUSED_KEY.id;
    }
    return lists.some((list) => list.key === second) ? SUBCATEGORY_REFUSED_KEY.name : null;
  }

  /** The subcategory fields that pick among those of the content a relation points to. */
  private subcategoryFieldsOf(relation: string): SubcategoryField[] {
    return this.entity.fields.filter(
      (field): field is SubcategoryField => field.kind === 'subcategory' && field.of === relation,
    );
  }

  private subcategoriesIn(key: string): SubcategoryDraft[] {
    const value = this.draft()?.[key];
    return Array.isArray(value) ? (value as SubcategoryDraft[]) : [];
  }

  private writeSubcategories(key: string, entries: SubcategoryDraft[]): void {
    this.draft.update((draft) => draft && { ...draft, [key]: entries });
  }

  /** Entries moved or removed: what was refused at a position is no longer there. */
  private forgetRefusalsOf(key: string): void {
    this.refusedFields.update((refused) =>
      Object.fromEntries(
        Object.entries(refused).filter(
          ([field]) => !field.startsWith(`${key}.`) && !field.includes(`.${key}.`),
        ),
      ),
    );
  }

  private writeTranslation(change: TranslationDraft): void {
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

  /** Lets go of the object URLs of every file a draft holds unsaved. */
  private releasePreviews(draft: EntityDraft | null): void {
    Object.values(draft ?? {}).forEach((value) => this.releasePreview(value));
  }

  private releasePreview(value: unknown): void {
    if (isImageDraft(value) && 'chosen' in value) {
      URL.revokeObjectURL(value.preview);
    }
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
