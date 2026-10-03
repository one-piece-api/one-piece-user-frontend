import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, type Params } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { CurrentUserService } from '../../identity/current-user';
import { MascotService } from '../../shared/mascot/mascot';
import { Breadcrumb, type Crumb } from '../../shared/ui/breadcrumb';
import { buttonClasses } from '../../shared/ui/button-variants';
import { LoadingPlaceholder } from '../../shared/ui/loading-placeholder';
import {
  STATUS_LABEL_KEY,
  contentSerial,
  localizedName,
  versionToShow,
  type Content,
  type Version,
  type VersionAction,
  type VersionEvent,
} from '../content.model';
import { LanguageCatalogService } from '../language-catalog';
import { momentLabel } from '../moment-label';
import { STATUS_BORDER_CLASS, StatusBadge } from '../status-badge';
import { VersionChain } from '../version-chain';
import {
  VERSION_TRANSITIONS,
  transitionRefusal,
  type TransitionRefusal,
  type VersionTransition,
} from '../version-transition';
import { VersionWorkflow } from '../version-workflow';
import { DevilFruitTypeCard } from './devil-fruit-type-card';
import { draftFieldKey, namesOf, type DevilFruitType } from './devil-fruit-type.model';

const ENDPOINT = '/api/content/devil-fruit-types';
const LIST_ROUTE = '/content/devil-fruit-types';

/** The query parameters this page keeps its view in, so a link reopens the same version. */
const PARAM = { version: 'v', tab: 'tab' } as const;

const TABS = [
  { id: 'overview', labelKey: 'content.detail.tab.overview', icon: '◈' },
  { id: 'workflow', labelKey: 'content.detail.tab.workflow', icon: '⚓' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** A version and its history, loaded together so the screen never shows one without the other. */
interface VersionView {
  readonly version: Version<DevilFruitType>;
  readonly events: VersionEvent[];
}

/** What the backend answers for a content that is not there - or not for this caller. */
const NOT_FOUND_STATUSES = [400, 404];

/**
 * The detail of a Devil Fruit Type (UF-CNT-12): its header, the chain of the versions the
 * caller may see, and the selected version's card and workflow. The selected version and the
 * open tab live in the URL's query parameters; without them the most recent visible version
 * is shown.
 */
@Component({
  selector: 'app-devil-fruit-type-detail',
  templateUrl: './devil-fruit-type-detail.html',
  imports: [
    Breadcrumb,
    DevilFruitTypeCard,
    LoadingPlaceholder,
    RouterLink,
    StatusBadge,
    TranslocoPipe,
    VersionChain,
    VersionWorkflow,
  ],
})
export class DevilFruitTypeDetail {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly languageCatalog = inject(LanguageCatalogService);

  /** Bound by the router: the path's id, then the `v` and `tab` query parameters. */
  readonly id = input.required<string>();
  readonly v = input<string>();
  readonly tab = input<string>();

  private readonly content = httpResource<Content>(() => `${ENDPOINT}/${this.id()}`);

  /** The chain: the versions the caller may see, oldest first, and which one is online. */
  protected readonly versions = computed(() =>
    this.content.hasValue() ? this.content.value().versions : [],
  );
  protected readonly onlineVersionNumber = computed(() =>
    this.content.hasValue() ? this.content.value().onlineVersionNumber : null,
  );

  /** The link of the chain to show: the one the URL asks for, else the most recent. */
  protected readonly selected = computed(() =>
    versionToShow(this.versions(), Number(this.v()) || null),
  );

  private readonly versionUrl = computed(() => {
    const selected = this.selected();
    return selected ? `${ENDPOINT}/${this.id()}/versions/${selected.number}` : undefined;
  });
  private readonly version = httpResource<Version<DevilFruitType>>(() => this.versionUrl());
  private readonly versionEvents = httpResource<VersionEvent[]>(() => {
    const url = this.versionUrl();
    return url ? `${url}/events` : undefined;
  });

  /** The version on screen: the last one loaded stays up while the next one is on its way. */
  private readonly view = linkedSignal<VersionView | undefined, VersionView | undefined>({
    source: () =>
      this.version.hasValue() && this.versionEvents.hasValue()
        ? { version: this.version.value(), events: this.versionEvents.value() }
        : undefined,
    computation: (loaded, previous) => loaded ?? previous?.value,
  });
  protected readonly shown = computed(() => this.view()?.version);
  /** Its history, oldest first: the Workflow tab, and the counter on it. */
  protected readonly events = computed(() => this.view()?.events ?? []);

  protected readonly state = computed<'loading' | 'missing' | 'error' | 'ready'>(() => {
    const error = this.content.error() ?? this.version.error() ?? this.versionEvents.error();
    if (error) {
      return isNotFound(error) ? 'missing' : 'error';
    }
    return this.shown() ? 'ready' : 'loading';
  });

  protected readonly languages = computed(() => this.languageCatalog.languages.value() ?? []);

  protected readonly title = computed(() => {
    const language = this.transloco.activeLang();
    const version = this.shown();
    if (!version) {
      return '';
    }
    return (
      localizedName(namesOf(version.body), language) ??
      version.body.romaji ??
      this.transloco.translate('content.list.unnamed')
    );
  });

  protected readonly serial = computed(() => contentSerial(this.id()));
  protected readonly borderClass = computed(() => {
    const version = this.shown();
    return version ? STATUS_BORDER_CLASS[version.status] : '';
  });

  protected readonly crumbs = computed<Crumb[]>(() => {
    this.transloco.activeLang();
    const crumbs: Crumb[] = [
      { label: this.transloco.translate('content.breadcrumb.contents') },
      {
        label: this.transloco.translate('content.devilFruitTypes.title'),
        icon: '◈',
        route: LIST_ROUTE,
      },
    ];
    // The last crumb is never a link: without the content's own, the section's would be it.
    crumbs.push({
      label: this.shown() ? this.title() : this.transloco.translate('content.detail.crumb'),
    });
    return crumbs;
  });

  /** "3 versions": how many the caller may see. */
  protected readonly versionCount = computed(() => {
    this.transloco.activeLang();
    const count = this.versions().length;
    const key = count === 1 ? 'content.detail.versionCountOne' : 'content.detail.versionCountMany';
    return this.transloco.translate(key, { count });
  });

  /** "v2 · Published", then "by nami · today 08:45 · the most recent". */
  protected readonly selectedBar = computed(() => {
    this.transloco.activeLang();
    const version = this.shown();
    if (!version) {
      return null;
    }
    const status = this.transloco.translate(STATUS_LABEL_KEY[version.status]);
    const authoredByMe = version.author.username === this.currentUser.me.value()?.username;
    const author = authoredByMe
      ? this.transloco.translate('content.list.you')
      : version.author.username;
    const parts = [
      this.transloco.translate('content.detail.by', { author }),
      momentLabel(this.transloco, version.createdAt),
    ];
    if (this.isMostRecent(version.number)) {
      parts.push(this.transloco.translate(this.mostRecentKey()));
    }
    return { title: `v${version.number} · ${status}`, line: parts.join(' · ') };
  });

  protected readonly tabs = TABS;
  protected readonly openTab = computed<TabId>(() =>
    this.tab() === 'workflow' ? 'workflow' : 'overview',
  );

  /** A transition posted and not answered yet. */
  protected readonly acting = signal(false);

  protected readonly backButtonClasses = buttonClasses('secondary');
  protected readonly listRoute = LIST_ROUTE;

  protected selectVersion(number: number): void {
    this.navigate({ [PARAM.version]: number });
  }

  /** Acts on the version on screen: reopens it in the editor, or runs a transition on it. */
  protected act(action: VersionAction): void {
    if (action === 'EDIT') {
      void this.router.navigate(['edit'], { relativeTo: this.route });
      return;
    }
    const transition = VERSION_TRANSITIONS[action];
    const url = this.versionUrl();
    if (transition && url) {
      void this.runTransition(transition, `${url}/${transition.path}`);
    }
  }

  /**
   * Posts the transition, says how it went, and reloads the content whatever the outcome:
   * a refusal often means the version moved meanwhile, and the screen should show where.
   */
  private async runTransition(transition: VersionTransition, url: string): Promise<void> {
    this.acting.set(true);
    try {
      await firstValueFrom(this.http.post<Version<DevilFruitType>>(url, null));
      this.mascot.show(this.transloco.translate(transition.doneKey), 'success');
    } catch (error) {
      this.mascot.show(this.refusalMessage(transitionRefusal(error)), 'error');
    } finally {
      this.content.reload();
      this.version.reload();
      this.versionEvents.reload();
      this.acting.set(false);
    }
  }

  private refusalMessage(refusal: TransitionRefusal): string {
    const key = (name: string) => `content.workflow.refused.${name}`;
    switch (refusal.kind) {
      case 'incomplete':
      case 'taken':
        return this.transloco.translate(key(refusal.kind), {
          fields: refusal.fields.map((field) => this.fieldLabel(field)).join(', '),
        });
      case 'identical':
        return this.transloco.translate(key('identical'), { version: refusal.version });
      case 'stale':
      case 'failed':
        return this.transloco.translate(key(refusal.kind));
    }
  }

  /** "romaji", "nome EN": a field named as the backend names it, in words. */
  private fieldLabel(field: string): string {
    const [language, name] = (draftFieldKey(field) ?? field).split('.');
    return name
      ? this.transloco.translate(`content.workflow.refused.field.${name}`, {
          language: language.toUpperCase(),
        })
      : this.transloco.translate('content.workflow.refused.field.romaji');
  }

  protected selectTab(tab: TabId): void {
    this.navigate({ [PARAM.tab]: tab === 'overview' ? null : tab });
  }

  private isMostRecent(number: number): boolean {
    return this.versions().at(-1)?.number === number;
  }

  /**
   * Who cannot write does not see drafts, so their most recent version may not be the
   * content's last one: the bar says so.
   */
  private mostRecentKey(): string {
    return this.currentUser.hasPermission('content:write')
      ? 'content.detail.mostRecent'
      : 'content.detail.mostRecentVisible';
  }

  /** Merges the change into the URL without a history entry: Back returns to the list. */
  private navigate(changes: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function isNotFound(error: Error): boolean {
  return error instanceof HttpErrorResponse && NOT_FOUND_STATUSES.includes(error.status);
}
