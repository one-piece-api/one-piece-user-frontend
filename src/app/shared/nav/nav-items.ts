import { AFFILIATION } from '../../content/affiliations/affiliation.model';
import { ARC } from '../../content/arcs/arc.model';
import { BOUNTY } from '../../content/bounties/bounty.model';
import { CHAPTER } from '../../content/chapters/chapter.model';
import { DEVIL_FRUIT_TYPE } from '../../content/devil-fruit-types/devil-fruit-type.model';
import { DEVIL_FRUIT } from '../../content/devil-fruits/devil-fruit.model';
import { EPISODE } from '../../content/episodes/episode.model';
import { SAGA } from '../../content/sagas/saga.model';
import { SPECIES } from '../../content/species/species.model';
import { VOLUME } from '../../content/volumes/volume.model';
import type { EntityDefinition } from '../../content/entity/entity-definition';
import { STATUS_LABEL_KEY } from '../../content/content.model';
import {
  DASHBOARD_ICON,
  DASHBOARD_ROUTE,
  OVERVIEW_ICON,
  STATUS_PAGES,
  statusPageRoute,
} from '../../content/dashboard/dashboard.model';
import { STATUS_GLYPH } from '../../content/status-badge';

export interface NavItem {
  readonly id: string;
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly label: string;
  readonly icon: string;
  /** Where the item leads. Absent on an item that is only announced (`soon`). */
  readonly route?: string;
  /** No permission required (undefined) means every signed-in user sees the item. */
  readonly permission?: string;
  /** Seen by whoever holds any of these - when one permission alone does not say it. */
  readonly anyPermission?: readonly string[];
  /** Highlighted only on its own route, not on the ones nested under it. */
  readonly exact?: boolean;
  /** Announced but not built yet: shown with a "coming soon" tag, and not a link. */
  readonly soon?: boolean;
}

/** A named set of sections inside a group, e.g. "Story" within "Contents". */
export interface NavSubgroup {
  readonly id: string;
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly labelKey: string;
  readonly icon: string;
  readonly items: readonly NavItem[];
}

/** What a group holds: a section, or a subgroup of sections (Composite). */
export type NavEntry = NavItem | NavSubgroup;

export interface NavGroup {
  /** A `transloco` translation key, not display text - the shell resolves it at render time. */
  readonly labelKey: string;
  readonly icon: string;
  /** Its flyout tells how many of its sections are already open (not `soon`). */
  readonly countsLiveItems?: boolean;
  readonly items: readonly NavEntry[];
}

export function isSubgroup(entry: NavEntry): entry is NavSubgroup {
  return 'labelKey' in entry;
}

/** Every section of a group, with the subgroups opened up. */
export function sectionsOf(group: NavGroup): readonly NavItem[] {
  return group.items.flatMap((entry) => (isSubgroup(entry) ? entry.items : [entry]));
}

/** The menu entry of an entity's section: named, drawn and reached as its definition says. */
export function entityNavItem(entity: EntityDefinition, label?: string): NavItem {
  return {
    id: entity.route.split('/').at(-1) ?? entity.route,
    label: label ?? `${entity.i18n}.title`,
    icon: entity.icon,
    route: entity.route,
    permission: 'content:read',
  };
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    // The overview across entity types (docs/user-flows/content-editorial-workflow.md 6);
    // then one entry per status page, for whoever sees that status.
    labelKey: 'shell.nav.dashboard',
    icon: DASHBOARD_ICON,
    items: [
      {
        id: 'dashboard',
        label: 'shell.nav.overview',
        icon: OVERVIEW_ICON,
        route: DASHBOARD_ROUTE,
        permission: 'content:read',
        exact: true,
      },
      ...STATUS_PAGES.map((page) => ({
        id: `dashboard:${page.slug}`,
        label: STATUS_LABEL_KEY[page.status],
        icon: STATUS_GLYPH[page.status],
        route: statusPageRoute(page.status),
        anyPermission: page.anyPermission,
      })),
    ],
  },
  {
    // One section per content entity (docs/user-flows/content-editorial-workflow.md 6), in
    // subgroups by domain: the ones not built yet are announced, so the menu shows where the
    // encyclopedia is going. The story structure is 3.1.3-3.1.7 of the same document.
    labelKey: 'shell.nav.contents',
    icon: 'assets/contents.webp',
    countsLiveItems: true,
    items: [
      {
        id: 'devil-fruits',
        labelKey: 'shell.nav.devilFruits',
        icon: 'assets/devil-fruit.webp',
        items: [
          entityNavItem(DEVIL_FRUIT, 'shell.nav.fruits'),
          entityNavItem(DEVIL_FRUIT_TYPE, 'shell.nav.fruitTypes'),
        ],
      },
      {
        id: 'crews-and-characters',
        labelKey: 'shell.nav.crewsAndCharacters',
        icon: 'assets/characters.webp',
        items: [
          entityNavItem(BOUNTY),
          entityNavItem(AFFILIATION),
          {
            id: 'characters',
            label: 'shell.nav.characters',
            icon: 'assets/characters.webp',
            permission: 'content:read',
            soon: true,
          },
          entityNavItem(SPECIES),
        ],
      },
      {
        id: 'story',
        labelKey: 'shell.nav.story',
        icon: 'assets/story.webp',
        items: [SAGA, ARC, VOLUME, CHAPTER, EPISODE].map((entity) => entityNavItem(entity)),
      },
    ],
  },
  {
    labelKey: 'shell.nav.account',
    icon: 'assets/profile.webp',
    items: [
      { id: 'profile', label: 'shell.nav.profile', icon: 'assets/profile.webp', route: '/profile' },
    ],
  },
  {
    labelKey: 'shell.nav.admin',
    icon: 'assets/admin.webp',
    items: [
      {
        id: 'users',
        label: 'shell.nav.crewManifest',
        icon: '⚑',
        route: '/users',
        permission: 'users:read',
      },
      {
        id: 'roles',
        label: 'shell.nav.rolesPermissions',
        icon: '⚙',
        route: '/roles',
        permission: 'roles:manage',
      },
      {
        id: 'audit',
        label: 'shell.nav.shipsLog',
        icon: '▤',
        route: '/audit',
        permission: 'audit:read',
      },
      {
        id: 'languages',
        label: 'shell.nav.languages',
        icon: '⚐',
        route: '/languages',
        permission: 'languages:manage',
      },
    ],
  },
];
