import type { TranslocoService } from '@jsverse/transloco';
import type { BlockCause } from './content.model';
import { entityOf } from './entity/entities';

/** The section a fruit lives in - what a type that cannot be retired points to. */
const FRUIT_ENTITY = 'DEVIL_FRUIT';

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
    case 'ONLINE_FRUITS_LINKED': {
      const { count, fruits } = cause.detail;
      const route = entityOf(FRUIT_ENTITY)?.route;
      const links = fruits.map((fruit) => ({
        label: fruit.romaji ?? fruit.id,
        route: route ? `${route}/${fruit.id}` : '',
      }));
      const sentence = text('sentence.ONLINE_FRUITS_LINKED', { count });
      const more = Math.max(count - links.length, 0);
      const names = links.map(({ label }) => label).join(', ');
      return {
        note: text('note.ONLINE_FRUITS_LINKED', { count }),
        sentence,
        links,
        more,
        titled:
          more > 0
            ? `${sentence} ${names} ${text('andMore', { count: more })}`
            : `${sentence} ${names}`,
      };
    }
  }
}
