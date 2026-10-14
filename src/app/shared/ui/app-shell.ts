import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { isActive, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { logoutUrl } from '../../identity/auth-urls';
import { CurrentUserService } from '../../identity/current-user';
import { LanguageSwitcher } from '../i18n/language-switcher';
import { MascotService } from '../mascot/mascot';
import { PROFILE_ROUTE } from '../nav/home.guard';
import {
  isSubgroup,
  NAV_GROUPS,
  sectionsOf,
  type NavEntry,
  type NavGroup,
  type NavItem,
  type NavSubgroup,
} from '../nav/nav-items';
import { Icon } from './icon';
import { initialsOf } from './initials';

/** The group whose sections are listed in the panel beside the sidebar (desktop). */
interface Flyout {
  readonly group: NavGroup;
  /** Viewport offset of the panel, aligned with the group's entry. */
  readonly top: number;
  /** Opened by a click: it stays until clicked again or closed, instead of following the pointer. */
  readonly pinned: boolean;
}

/** The subgroup whose sections are listed in a second panel, beside the flyout (desktop). */
interface SubgroupPanel {
  readonly subgroup: NavSubgroup;
  /** Viewport offset of the panel, aligned with the subgroup's entry in the flyout. */
  readonly top: number;
}

/** How long the pointer may travel from a group to its flyout before the flyout closes. */
const FLYOUT_CLOSE_DELAY_MS = 180;
/** Room the flyout keeps above its entry, for its header, and from the viewport edges. */
const FLYOUT_OFFSET_PX = 10;
const FLYOUT_VIEWPORT_MARGIN_PX = 12;
/** Estimated flyout height, to keep it inside the viewport near the bottom of the sidebar. */
const FLYOUT_HEADER_PX = 60;
const FLYOUT_ROW_PX = 48;
/** Marks the elements that belong to the flyout interaction: a click elsewhere closes it. */
const FLYOUT_AREA_SELECTOR = '[data-nav-flyout-area]';

/**
 * The application's page shell: a persistent sidebar (desktop) / off-canvas drawer
 * (mobile) wrapping every route's content. Sections are read from the nav registry
 * (`shared/nav/nav-items.ts`), not hardcoded per role. A group with several sections is one
 * entry: on desktop its sections open in a flyout beside the sidebar (on hover, pinned by a
 * click); in the mobile drawer they expand inline under it. A group with a single section
 * shows that section directly, and a group with its own route (the Dashboard) is also a link.
 * A group may gather its sections in subgroups: on desktop a subgroup opens its sections in a
 * second panel beside the flyout, in the drawer it is a collapsible heading. A subgroup with a
 * single visible section shows that section directly, like a group does.
 */
@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.html',
  imports: [RouterLink, TranslocoPipe, LanguageSwitcher, NgTemplateOutlet, Icon],
  host: {
    '(document:click)': 'closeFlyoutOnOutsideClick($event)',
    '(document:keydown.escape)': 'closeFlyout()',
  },
})
export class AppShell {
  protected readonly currentUser = inject(CurrentUserService);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotService);
  private readonly router = inject(Router);
  protected readonly logoutUrl = logoutUrl();
  protected readonly profileRoute = PROFILE_ROUTE;
  protected readonly navGroups = NAV_GROUPS;
  protected readonly drawerOpen = signal(false);
  protected readonly flyout = signal<Flyout | null>(null);
  protected readonly subgroupPanel = signal<SubgroupPanel | null>(null);
  protected readonly isSubgroup = isSubgroup;
  /** Groups the user expanded (true) or collapsed (false) inline in the mobile drawer, by label key. */
  private readonly toggledGroups = signal<ReadonlyMap<string, boolean>>(new Map());
  /** Subgroups the user collapsed (false) or expanded again (true) in the mobile drawer, by id. */
  private readonly toggledSubgroups = signal<ReadonlyMap<string, boolean>>(new Map());
  private flyoutCloseTimer?: ReturnType<typeof setTimeout>;

  /** One router-backed signal per routed item, so the active entry follows navigation. */
  private readonly activeItems: ReadonlyMap<string, Signal<boolean>> = new Map(
    NAV_GROUPS.flatMap(sectionsOf).flatMap((item) =>
      item.route
        ? [
            [
              item.id,
              isActive(item.route, this.router, {
                paths: item.exact ? 'exact' : 'subset',
                queryParams: 'ignored',
                fragment: 'ignored',
                matrixParams: 'ignored',
              }),
            ] as const,
          ]
        : [],
    ),
  );

  /** One computed string so the open/closed translate utilities are never both present at once. */
  protected readonly asideClasses = computed(
    () =>
      `fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-6 overflow-y-auto overscroll-contain scrollbar-treasure bg-ocean-900 p-5 shadow-2xl transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${
        this.drawerOpen() ? 'translate-x-0' : '-translate-x-full'
      }`,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.flyoutCloseTimer));
  }

  /** The sections of a group the user may see, subgroups opened up. */
  protected visibleItems(group: NavGroup): readonly NavItem[] {
    return sectionsOf(group).filter((item) => this.isVisible(item));
  }

  /**
   * What the flyout and the drawer list for a group: its visible sections, and its subgroups
   * trimmed to the visible sections - a subgroup left with one is that section, with none is gone.
   */
  protected visibleEntries(group: NavGroup): readonly NavEntry[] {
    return group.items.flatMap((entry): NavEntry[] => {
      if (!isSubgroup(entry)) return this.isVisible(entry) ? [entry] : [];
      const items = entry.items.filter((item) => this.isVisible(item));
      if (items.length <= 1) return items;
      return [{ ...entry, items }];
    });
  }

  private isVisible(item: NavItem): boolean {
    return item.anyPermission
      ? this.currentUser.hasAnyPermission(item.anyPermission)
      : this.currentUser.hasPermission(item.permission);
  }

  protected isItemActive(item: NavItem): boolean {
    return this.activeItems.get(item.id)?.() ?? false;
  }

  /** The group holding the current page: it carries the same marker as the active section. */
  protected isGroupActive(group: NavGroup): boolean {
    return this.visibleItems(group).some((item) => this.isItemActive(item));
  }

  protected isSubgroupActive(subgroup: NavSubgroup): boolean {
    return subgroup.items.some((item) => this.isItemActive(item));
  }

  protected isSubgroupPanelOpen(subgroup: NavSubgroup): boolean {
    return this.subgroupPanel()?.subgroup.id === subgroup.id;
  }

  /** Mobile only: every subgroup starts expanded, the user's own toggle wins. */
  protected isSubgroupExpanded(subgroup: NavSubgroup): boolean {
    return this.toggledSubgroups().get(subgroup.id) ?? true;
  }

  protected toggleSubgroupInline(subgroup: NavSubgroup): void {
    const expanded = this.isSubgroupExpanded(subgroup);
    this.toggledSubgroups.update((toggled) => new Map(toggled).set(subgroup.id, !expanded));
  }

  protected isFlyoutOpen(group: NavGroup): boolean {
    return this.flyout()?.group === group;
  }

  /**
   * Mobile only (the template hides it on desktop): the active group starts expanded, but the
   * user's own toggle wins - the current page's group can be collapsed too.
   */
  protected isExpandedInline(group: NavGroup): boolean {
    return this.toggledGroups().get(group.labelKey) ?? this.isGroupActive(group);
  }

  /**
   * The state-dependent look of a sidebar entry (group or section): the gold tab on the left
   * and the lighter fill mark where the user is; a hovered or opened group is lit, untabbed.
   */
  protected entryStateClasses(active: boolean, highlighted = active, soon = false): string {
    const marker = active ? 'border-treasure-500' : 'border-transparent';
    if (highlighted) return `${marker} bg-white/14 text-parchment-100`;
    return `${marker} ${soon ? 'text-nav-soon-ink' : 'text-nav-ink'}`;
  }

  protected entryIconClasses(highlighted: boolean, soon = false): string {
    if (highlighted) return 'text-treasure-500';
    return soon ? 'text-nav-soon-icon' : 'text-nav-icon';
  }

  /** A long list scrolls inside the flyout rather than running past the viewport. */
  protected flyoutListMaxHeight(panel: Flyout): string {
    return `calc(100vh - ${panel.top + FLYOUT_HEADER_PX + FLYOUT_OFFSET_PX}px)`;
  }

  protected liveItemCount(group: NavGroup): number {
    return this.visibleItems(group).filter((item) => !item.soon).length;
  }

  protected liveSubgroupItemCount(subgroup: NavSubgroup): number {
    return subgroup.items.filter((item) => !item.soon).length;
  }

  /** Hover shows a subgroup's sections only with a mouse: a tap is followed by a click. */
  protected openSubgroupPanelOnHover(event: PointerEvent, subgroup: NavSubgroup): void {
    if (event.pointerType === 'mouse') this.openSubgroupPanel(event, subgroup);
  }

  protected toggleSubgroupPanel(event: MouseEvent, subgroup: NavSubgroup): void {
    if (this.isSubgroupPanelOpen(subgroup)) this.subgroupPanel.set(null);
    else this.openSubgroupPanel(event, subgroup);
  }

  /** Hover opens the flyout only with a mouse: a tap also fires pointer events, and is a click. */
  protected openFlyoutOnHover(event: PointerEvent, group: NavGroup): void {
    if (event.pointerType !== 'mouse') return;
    const current = this.flyout();
    if (current?.pinned && current.group !== group) return;
    this.openFlyout(event, group, current?.group === group && current.pinned);
  }

  /** A click pins the flyout (or closes a pinned one) on desktop and toggles the inline list on mobile. */
  protected toggleGroup(event: MouseEvent, group: NavGroup): void {
    const current = this.flyout();
    if (current?.group === group && current.pinned) this.closeFlyout();
    else this.openFlyout(event, group, true);
    const expanded = this.isExpandedInline(group);
    this.toggledGroups.update((toggled) => new Map(toggled).set(group.labelKey, !expanded));
  }

  protected keepFlyoutOpen(): void {
    clearTimeout(this.flyoutCloseTimer);
  }

  /** Leaving a group or its flyout closes a hover-opened flyout, after time to reach the other. */
  protected scheduleFlyoutClose(): void {
    clearTimeout(this.flyoutCloseTimer);
    this.flyoutCloseTimer = setTimeout(() => {
      if (!this.flyout()?.pinned) this.closeFlyout();
    }, FLYOUT_CLOSE_DELAY_MS);
  }

  protected closeFlyout(): void {
    clearTimeout(this.flyoutCloseTimer);
    this.flyout.set(null);
    this.subgroupPanel.set(null);
  }

  protected closeFlyoutOnOutsideClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (this.flyout() && !target?.closest(FLYOUT_AREA_SELECTOR)) this.closeFlyout();
  }

  /** Following a section closes every menu that led to it. */
  protected navigated(): void {
    this.closeFlyout();
    this.closeDrawer();
  }

  /** An announced section is not a destination yet: the mascot says so instead. */
  protected announceSoon(item: NavItem): void {
    this.closeFlyout();
    const label = this.transloco.translate(item.label);
    this.mascot.show(this.transloco.translate('shell.nav.soonMessage', { label }), 'info');
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected readonly initials = initialsOf;

  private openFlyout(event: Event, group: NavGroup, pinned: boolean): void {
    clearTimeout(this.flyoutCloseTimer);
    const entryTop = (event.currentTarget as HTMLElement).getBoundingClientRect().top;
    const height = FLYOUT_HEADER_PX + this.visibleEntries(group).length * FLYOUT_ROW_PX;
    const top = Math.max(
      FLYOUT_VIEWPORT_MARGIN_PX,
      Math.min(entryTop - FLYOUT_OFFSET_PX, window.innerHeight - height),
    );
    if (this.flyout()?.group !== group) this.subgroupPanel.set(null);
    this.flyout.set({ group, top, pinned });
  }

  private openSubgroupPanel(event: Event, subgroup: NavSubgroup): void {
    clearTimeout(this.flyoutCloseTimer);
    const entryTop = (event.currentTarget as HTMLElement).getBoundingClientRect().top;
    const height = FLYOUT_HEADER_PX + subgroup.items.length * FLYOUT_ROW_PX;
    const top = Math.max(
      FLYOUT_VIEWPORT_MARGIN_PX,
      Math.min(entryTop - FLYOUT_OFFSET_PX, window.innerHeight - height),
    );
    this.subgroupPanel.set({ subgroup, top });
  }
}
