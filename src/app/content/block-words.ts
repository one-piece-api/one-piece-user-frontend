import type { TranslocoService } from '@jsverse/transloco';
import {
  KEYED_ITEMS,
  STORY_ITEMS,
  STORY_RELATIONS,
  type BlockCause,
  type KeyedItem,
  type KeyedItems,
  type StoryItems,
} from './content.model';
import { entityOf } from './entity/entities';

/** The section a fruit lives in - what a type that cannot be retired points to. */
const FRUIT_ENTITY = 'DEVIL_FRUIT';
/** The section an affiliation lives in - what a rank outside the Navy points to. */
const AFFILIATION_ENTITY = 'AFFILIATION';
/** The section a character lives in - what an affiliation that keeps ranks points to. */
const CHARACTER_ENTITY = 'CHARACTER';
/** The section a bounty lives in - what an already replaced previous bounty points to. */
const BOUNTY_ENTITY = 'BOUNTY';

/** The section each kind of story item lives in - what a content that cannot be retired points to. */
const STORY_ITEM_ENTITY: Record<StoryItems | KeyedItems, string> = {
  arcs: 'ARC',
  chapters: 'CHAPTER',
  episodes: 'EPISODE',
  fruits: 'DEVIL_FRUIT',
  types: 'DEVIL_FRUIT_TYPE',
  bounties: BOUNTY_ENTITY,
  affiliations: 'AFFILIATION',
  species: 'SPECIES',
  characters: 'CHARACTER',
};

/** A keyed content as a block names it: its romaji or key, else its id. */
function keyedLabel(item: KeyedItem): string {
  return item.romaji ?? item.key ?? item.id;
}

/** A content that stands in the way, named and leading to its page. */
export interface BlockLink {
  readonly label: string;
  readonly route: string;
}

/**
 * A refusal told in words: a short `note` for under a status of the route, the `sentence`
 * for the reader and, when other contents stand in the way, `links` to them and how many
 * `more` there are than are named. `titled` is the sentence with the names in it, for a
 * place where a link cannot go - a tooltip, the mascot.
 */
export interface BlockWords {
  readonly note: string;
  readonly sentence: string;
  readonly links: readonly BlockLink[];
  readonly more: number;
  readonly titled: string;
}

/**
 * Words for why the content refuses an action. Which reasons exist is closed (the backend
 * names them), so each one is worded here - and an unknown one is not worded at all but
 * shown as the backend says it. An Adapter between the backend's reason and the page.
 */
export function blockWords(transloco: TranslocoService, cause: BlockCause): BlockWords {
  const text = (key: string, params: Record<string, unknown> = {}) =>
    transloco.translate(`content.workflow.blocked.${key}`, params);
  switch (cause.reason) {
    case 'TYPE_NOT_ONLINE': {
      const sentence = text('sentence.TYPE_NOT_ONLINE');
      return { note: text('note.TYPE_NOT_ONLINE'), sentence, links: [], more: 0, titled: sentence };
    }
    case 'SUBCATEGORY_NOT_ONLINE': {
      const names = cause.detail.subcategoryNames ?? {};
      const subcategory =
        names[transloco.getActiveLang()] ||
        Object.values(names).find(Boolean) ||
        cause.detail.subcategoryId;
      const sentence = text('sentence.SUBCATEGORY_NOT_ONLINE', { subcategory });
      return {
        note: text('note.SUBCATEGORY_NOT_ONLINE'),
        sentence,
        links: [],
        more: 0,
        titled: sentence,
      };
    }
    case 'RELATED_NOT_ONLINE': {
      const relation =
        STORY_RELATIONS.find((candidate) => `${candidate}Id` in cause.detail) ?? 'arc';
      const sentence = text(`sentence.RELATED_NOT_ONLINE.${relation}`);
      return {
        note: text(`note.RELATED_NOT_ONLINE.${relation}`),
        sentence,
        links: [],
        more: 0,
        titled: sentence,
      };
    }
    case 'ONLINE_ITEMS_LINKED': {
      const keyed = KEYED_ITEMS.find((candidate) => candidate in cause.detail);
      const items = keyed ?? STORY_ITEMS.find((candidate) => candidate in cause.detail) ?? 'arcs';
      const route = entityOf(STORY_ITEM_ENTITY[items])?.route;
      const named = keyed
        ? (cause.detail[keyed] ?? []).map((item) => ({ id: item.id, label: keyedLabel(item) }))
        : (cause.detail[items as StoryItems] ?? []).map(({ id, number }) => ({
            id,
            label: String(number),
          }));
      const links = named.map(({ id, label }) => ({
        label,
        route: route ? `${route}/${id}` : '',
      }));
      return linkedWords(transloco, cause, `${cause.reason}.${items}`, links);
    }
    case 'FIRST_APPEARANCE_MISSING': {
      const sentence = text('sentence.FIRST_APPEARANCE_MISSING');
      return {
        note: text('note.FIRST_APPEARANCE_MISSING'),
        sentence,
        links: [],
        more: 0,
        titled: sentence,
      };
    }
    case 'MARINE_RANK_NOT_ALLOWED': {
      const { affiliationId, affiliationRomaji } = cause.detail;
      const route = entityOf(AFFILIATION_ENTITY)?.route;
      const link = { label: affiliationRomaji, route: route ? `${route}/${affiliationId}` : '' };
      const sentence = text('sentence.MARINE_RANK_NOT_ALLOWED');
      return {
        note: text('note.MARINE_RANK_NOT_ALLOWED'),
        sentence,
        links: [link],
        more: 0,
        titled: `${sentence} ${link.label}`,
      };
    }
    case 'MARINE_RANK_IN_USE': {
      const route = entityOf(CHARACTER_ENTITY)?.route;
      const links = cause.detail.characters.map((character) => ({
        label: keyedLabel(character),
        route: route ? `${route}/${character.id}` : '',
      }));
      return linkedWords(transloco, cause, cause.reason, links);
    }
    case 'DEVIL_FRUIT_IN_USE': {
      const route = entityOf(CHARACTER_ENTITY)?.route;
      const { devilFruitRomaji, characters } = cause.detail;
      const links = characters.map((character) => ({
        label: keyedLabel(character),
        route: route ? `${route}/${character.id}` : '',
      }));
      if (devilFruitRomaji === undefined) {
        const count = cause.detail.count ?? links.length;
        return linkedWords(transloco, { detail: { count } }, 'DEVIL_FRUIT_IN_USE.fruit', links);
      }
      const sentence = text('sentence.DEVIL_FRUIT_IN_USE.character', { fruit: devilFruitRomaji });
      return {
        note: text('note.DEVIL_FRUIT_IN_USE.character'),
        sentence,
        links,
        more: 0,
        titled: `${sentence} ${links.map(({ label }) => label).join(', ')}`,
      };
    }
    case 'RELATIVE_ALREADY_LINKED': {
      const { relativeId, relativeRomaji } = cause.detail;
      const route = entityOf(CHARACTER_ENTITY)?.route;
      const link = { label: relativeRomaji, route: route ? `${route}/${relativeId}` : '' };
      const sentence = text('sentence.RELATIVE_ALREADY_LINKED');
      return {
        note: text('note.RELATIVE_ALREADY_LINKED'),
        sentence,
        links: [link],
        more: 0,
        titled: `${sentence} ${link.label}`,
      };
    }
    case 'ONLINE_FRUITS_LINKED':
    case 'SUBCATEGORY_IN_USE': {
      const route = entityOf(FRUIT_ENTITY)?.route;
      const links = cause.detail.fruits.map((fruit) => ({
        label: fruit.romaji ?? fruit.id,
        route: route ? `${route}/${fruit.id}` : '',
      }));
      return linkedWords(transloco, cause, cause.reason, links);
    }
    case 'PREVIOUS_ALREADY_REPLACED': {
      const route = entityOf(BOUNTY_ENTITY)?.route;
      const { replacedBy } = cause.detail;
      const link = {
        label: keyedLabel(replacedBy),
        route: route ? `${route}/${replacedBy.id}` : '',
      };
      const sentence = text('sentence.PREVIOUS_ALREADY_REPLACED');
      return {
        note: text('note.PREVIOUS_ALREADY_REPLACED'),
        sentence,
        links: [link],
        more: 0,
        titled: `${sentence} ${link.label}`,
      };
    }
    case 'BOUNTY_CHAIN_CYCLE': {
      const sentence = text('sentence.BOUNTY_CHAIN_CYCLE');
      return {
        note: text('note.BOUNTY_CHAIN_CYCLE'),
        sentence,
        links: [],
        more: 0,
        titled: sentence,
      };
    }
  }
}

/** The words for a refusal that names the contents in the way: `key` is that of its note and sentence. */
function linkedWords(
  transloco: TranslocoService,
  cause: { detail: { count: number } },
  key: string,
  links: readonly BlockLink[],
): BlockWords {
  const { count } = cause.detail;
  const text = (part: string, params: Record<string, unknown> = {}) =>
    transloco.translate(`content.workflow.blocked.${part}`, params);
  const sentence = text(`sentence.${key}`, { count });
  const more = Math.max(count - links.length, 0);
  const names = links.map(({ label }) => label).join(', ');
  return {
    note: text(`note.${key}`, { count }),
    sentence,
    links,
    more,
    titled:
      more > 0
        ? `${sentence} ${names} ${text('andMore', { count: more })}`
        : `${sentence} ${names}`,
  };
}
