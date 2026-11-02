import { BOUNTY } from '../bounties/bounty.model';
import { CHARACTER } from '../characters/character.model';
import { DEVIL_FRUIT } from '../devil-fruits/devil-fruit.model';
import {
  INITIAL_NODE,
  REVEALED_AT,
  REVEAL_TITLE,
  TRUTH_NODE,
  diffReveals,
  forwardTimeline,
  incompleteLanguages,
  newReveal,
  orderedReveals,
  revealRefusalKey,
  revealRefusalOf,
  revealTitleOf,
  revealsDraftOf,
  revealsSaved,
  truthOf,
  withRevealedGroup,
  type RevealDraft,
  type RevealsDraft,
} from './entity-reveals';

const LANGUAGES = ['it', 'en'];
const CH_1 = { id: 'c1', number: 1 };
const EP_1 = { id: 'e1', number: 1 };
const CH_1044 = { id: 'c1044', number: 1044 };
const EP_1071 = { id: 'e1071', number: 1071 };
const PARAMECIA = { id: 't-paramecia', romaji: 'Paramecia' };
const ZOAN = { id: 't-zoan', romaji: 'Zoan' };
const MYTHICAL = { id: 's-mythical', names: { it: 'Mitologico', en: 'Mythical' } };

const NIKA_REVEAL = {
  revealedAt: { chapter: CH_1044, episode: EP_1071 },
  titles: { it: 'Il frutto è Nika', en: 'The fruit is Nika' },
  fields: ['TYPE', 'NAME', 'ROMAJI'],
};

/** Hito Hito no Mi, Model: Nika: believed to be the Gomu Gomu no Mi until chapter 1044. */
function nika(reveals: readonly object[] = [NIKA_REVEAL]): Record<string, unknown> {
  return {
    romaji: 'Hito Hito no Mi, Model: Nika',
    type: ZOAN,
    subcategory: MYTHICAL,
    firstAppearance: { chapter: CH_1, episode: EP_1 },
    translations: {
      it: { name: 'Frutto Homo Homo, modello Nika' },
      en: { name: 'Human-Human Fruit, Model: Nika' },
    },
    initialKnowledge: {
      romaji: 'Gomu Gomu no Mi',
      type: PARAMECIA,
      subcategory: null,
      translations: { it: { name: 'Frutto Gom Gom' }, en: { name: 'Gum-Gum Fruit' } },
    },
    reveals,
  };
}

function draftOf(body: Record<string, unknown>): RevealsDraft {
  return revealsDraftOf(DEVIL_FRUIT, body, LANGUAGES);
}

function reveal(point: object, groups: readonly string[], key = point.toString()): RevealDraft {
  return {
    ...newReveal(LANGUAGES),
    key,
    point: { chapter: null, episode: null, ...point },
    groups,
  };
}

const translate = (key: string, params: Record<string, string>) =>
  `${key}${Object.keys(params).length ? JSON.stringify(params) : ''}`;

describe('the reveals of a content', () => {
  describe('read from a version', () => {
    it('keeps the initial knowledge and names the choices in the definition order', () => {
      const draft = draftOf(nika());

      expect(draft.initial['romaji']).toBe('Gomu Gomu no Mi');
      expect(draft.initial['type']).toEqual(PARAMECIA);
      expect(draft.initial.translations['en']['name']).toBe('Gum-Gum Fruit');
      expect(draft.reveals).toHaveLength(1);
      expect(draft.reveals[0].groups).toEqual(['NAME', 'ROMAJI', 'TYPE']);
      expect(draft.reveals[0].point).toEqual({ chapter: CH_1044, episode: EP_1071 });
      expect(draft.reveals[0].titles).toEqual({ it: 'Il frutto è Nika', en: 'The fruit is Nika' });
    });

    it('has nothing to reveal where the version has no reveals', () => {
      const draft = revealsDraftOf(DEVIL_FRUIT, null, LANGUAGES);

      expect(draft.reveals).toEqual([]);
      expect(draft.initial.translations).toEqual({ it: { name: '' }, en: { name: '' } });
    });
  });

  describe('saved', () => {
    it('sends the initial values of the choices revealed, and no value on a last mention', () => {
      expect(revealsSaved(DEVIL_FRUIT, draftOf(nika()))).toEqual({
        initialKnowledge: {
          romaji: 'Gomu Gomu no Mi',
          type: 't-paramecia',
          subcategory: null,
          translations: { it: { name: 'Frutto Gom Gom' }, en: { name: 'Gum-Gum Fruit' } },
        },
        reveals: [
          {
            revealedAt: { chapter: 'c1044', episode: 'e1071' },
            fields: ['NAME', 'ROMAJI', 'TYPE'],
            titles: { it: 'Il frutto è Nika', en: 'The fruit is Nika' },
          },
        ],
      });
    });

    it('sends the value of a mention that a later reveal changes again', () => {
      const body = nika([
        { ...NIKA_REVEAL, fields: ['NAME'] },
        {
          revealedAt: { chapter: CH_1, episode: null },
          titles: { it: 'Primo nome', en: 'First name' },
          fields: ['NAME'],
          translations: { it: { name: 'Frutto di gomma' }, en: { name: 'Rubber Fruit' } },
        },
      ]);

      const saved = revealsSaved(DEVIL_FRUIT, draftOf(body)) as {
        reveals: Record<string, unknown>[];
      };

      // Chapter 1 comes first for the reader: it is not the last mention, so it keeps its name.
      expect(saved.reveals[0]).toEqual({
        revealedAt: { chapter: 'c1', episode: null },
        fields: ['NAME'],
        titles: { it: 'Primo nome', en: 'First name' },
        translations: { it: { name: 'Frutto di gomma' }, en: { name: 'Rubber Fruit' } },
      });
      expect(saved.reveals[1]['translations']).toBeUndefined();
    });

    it('sends only the initial values of revealed choices, and no blank title', () => {
      const draft = draftOf(nika([{ ...NIKA_REVEAL, fields: ['NAME'], titles: { it: ' ' } }]));

      const saved = revealsSaved(DEVIL_FRUIT, draft) as {
        initialKnowledge: Record<string, unknown>;
        reveals: Record<string, unknown>[];
      };

      expect(saved.initialKnowledge).toEqual({
        translations: { it: { name: 'Frutto Gom Gom' }, en: { name: 'Gum-Gum Fruit' } },
      });
      expect(saved.reveals[0]['titles']).toEqual({});
    });

    it('saves the identity of a Character as one choice', () => {
      const draft = revealsDraftOf(
        CHARACTER,
        {
          initialKnowledge: {
            romaji: 'Mr. 2 Bon Kurei',
            japaneseName: 'ボン・クレー',
            translations: { it: { name: 'Mr. 2' }, en: { name: 'Mr. 2' } },
          },
          reveals: [{ revealedAt: { chapter: CH_1044 }, fields: ['IDENTITY'], titles: {} }],
        },
        LANGUAGES,
      );
      const later = { ...draft.reveals[0], key: 'later', point: { chapter: CH_1, episode: null } };
      const saved = revealsSaved(CHARACTER, {
        ...draft,
        reveals: [...draft.reveals, later],
      }) as { initialKnowledge: object; reveals: Record<string, unknown>[] };

      expect(saved.initialKnowledge).toEqual({
        romaji: 'Mr. 2 Bon Kurei',
        japaneseName: 'ボン・クレー',
        translations: { it: { name: 'Mr. 2' }, en: { name: 'Mr. 2' } },
      });
      expect(Object.keys(saved.reveals[0])).toEqual([
        'revealedAt',
        'fields',
        'titles',
        'romaji',
        'japaneseName',
        'translations',
      ]);
    });

    it('saves whether a Bounty is inactive with no translations', () => {
      const draft = revealsDraftOf(
        BOUNTY,
        {
          initialKnowledge: { inactive: false },
          reveals: [{ revealedAt: { episode: EP_1071 }, fields: ['INACTIVE'], titles: {} }],
        },
        LANGUAGES,
      );

      expect(revealsSaved(BOUNTY, draft)['initialKnowledge']).toEqual({ inactive: false });
    });
  });

  describe('in the reader order', () => {
    it('puts the chapters first, then the episodes only, then the reveals without a point', () => {
      const none = reveal({}, ['NAME'], 'none');
      const episode = reveal({ episode: EP_1 }, ['NAME'], 'episode');
      const late = reveal({ chapter: CH_1044 }, ['NAME'], 'late');
      const early = reveal({ chapter: CH_1 }, ['NAME'], 'early');

      expect(orderedReveals([none, episode, late, early]).map(({ key }) => key)).toEqual([
        'early',
        'late',
        'episode',
        'none',
      ]);
    });
  });

  describe('on the forward timeline', () => {
    it('reads a last mention from the main fields and its earlier value from the start', () => {
      const body = nika();
      const draft = draftOf(body);
      const truth = truthOf(DEVIL_FRUIT, body, LANGUAGES);

      const [start, nikaNode] = forwardTimeline(DEVIL_FRUIT, truth, draft, body['firstAppearance']);

      expect(start.kind === 'firstAppearance' && start.groups).toEqual(['NAME', 'ROMAJI', 'TYPE']);
      const rows = nikaNode.kind === 'reveal' ? nikaNode.rows : [];
      expect(rows.map(({ beforeNode, afterNode, last }) => [beforeNode, afterNode, last])).toEqual([
        [INITIAL_NODE, TRUTH_NODE, true],
        [INITIAL_NODE, TRUTH_NODE, true],
        [INITIAL_NODE, TRUTH_NODE, true],
      ]);
      expect(rows[1].before['romaji']).toBe('Gomu Gomu no Mi');
      expect(rows[1].after['romaji']).toBe('Hito Hito no Mi, Model: Nika');
    });

    it('writes an earlier mention on its own reveal and reads the next from it', () => {
      const first = reveal({ chapter: CH_1 }, ['NAME'], 'first');
      const second = reveal({ chapter: CH_1044 }, ['NAME'], 'second');
      const draft: RevealsDraft = { ...draftOf(nika()), reveals: [second, first] };

      const nodes = forwardTimeline(DEVIL_FRUIT, draft.initial, draft, null);

      const rowsOf = (index: number) => {
        const node = nodes[index];
        return node.kind === 'reveal' ? node.rows[0] : null;
      };
      expect(rowsOf(1)).toMatchObject({ beforeNode: INITIAL_NODE, afterNode: 'first' });
      expect(rowsOf(2)).toMatchObject({ beforeNode: 'first', afterNode: TRUTH_NODE });
    });
  });

  describe('when a choice is named', () => {
    it('starts what the reader believed from the current value, where nothing is written', () => {
      const added = newReveal(LANGUAGES);
      const draft = withRevealedGroup(
        DEVIL_FRUIT,
        { initial: { translations: { it: {}, en: {} } }, reveals: [added] },
        added.key,
        'ROMAJI',
        { romaji: 'Mera Mera no Mi', translations: {} },
      );

      expect(draft.reveals[0].groups).toEqual(['ROMAJI']);
      expect(draft.initial['romaji']).toBe('Mera Mera no Mi');
    });

    it('keeps what the reader believed where it is written', () => {
      const draft = draftOf(nika([{ ...NIKA_REVEAL, fields: ['NAME'] }]));

      const named = withRevealedGroup(DEVIL_FRUIT, draft, draft.reveals[0].key, 'ROMAJI', {
        romaji: 'Hito Hito no Mi, Model: Nika',
        translations: {},
      });

      expect(named.reveals[0].groups).toEqual(['NAME', 'ROMAJI']);
      expect(named.initial['romaji']).toBe('Gomu Gomu no Mi');
    });
  });

  describe('refused by the backend', () => {
    const sent = ['first', 'second'];

    it('finds the reveal and what in it is at fault', () => {
      expect(revealRefusalOf('initialKnowledge.romaji', sent)).toEqual({
        node: INITIAL_NODE,
        target: 'romaji',
      });
      expect(revealRefusalOf('reveals[1]', sent)).toEqual({ node: 'second', target: 'node' });
      expect(revealRefusalOf('reveals[0].revealedAt.episode', sent)).toEqual({
        node: 'first',
        target: 'point',
      });
      expect(revealRefusalOf('reveals[1].titles[it]', sent)).toEqual({
        node: 'second',
        target: 'title.it',
      });
      expect(revealRefusalOf('reveals[0].translations[en].name', sent)).toEqual({
        node: 'first',
        target: 'en.name',
      });
      expect(revealRefusalOf('reveals[0].fields', sent)).toEqual({
        node: 'first',
        target: 'fields',
      });
    });

    it('ignores other fields and reveals no longer sent', () => {
      expect(revealRefusalOf('romaji', sent)).toBeNull();
      expect(revealRefusalOf('reveals[2].fields', sent)).toBeNull();
    });

    it('words each refusal by the backend message', () => {
      const node = { node: 'first', target: 'node' };
      const point = { node: 'first', target: 'point' };

      expect(revealRefusalKey(node, 'must name at least one field')).toBe(
        'content.reveals.error.fields',
      );
      expect(revealRefusalKey(node, 'must be left out: no reveal names NAME')).toBe(
        'content.reveals.error.notNamed',
      );
      expect(
        revealRefusalKey(node, 'must be known at the first appearance: a reveal names X'),
      ).toBe('content.reveals.error.alwaysKnown');
      expect(revealRefusalKey(node, 'is required with the other values of IDENTITY')).toBe(
        'content.reveals.error.keyMissing',
      );
      expect(
        revealRefusalKey(
          point,
          'must not share its point with an earlier reveal of NAME on the chapter axis',
        ),
      ).toBe('content.reveals.error.sharedPoint');
      expect(revealRefusalKey(point, 'is required')).toBe('content.reveals.error.point');
      expect(revealRefusalKey(point, 'must be after the first appearance')).toBe(
        'content.storyPoint.refused.notAfterFirstAppearance',
      );
      expect(revealRefusalKey(node, 'something new')).toBe('content.reveals.error.value');
    });
  });

  describe('before submitting', () => {
    it('is complete with every title and every name held', () => {
      expect(incompleteLanguages(DEVIL_FRUIT, draftOf(nika()), LANGUAGES)).toEqual([]);
    });

    it('asks for a missing title and a missing initial name per language', () => {
      const body = nika([{ ...NIKA_REVEAL, titles: { it: 'Il frutto è Nika' } }]);

      expect(incompleteLanguages(DEVIL_FRUIT, draftOf(body), LANGUAGES)).toEqual(['en']);

      const initial = body['initialKnowledge'] as Record<string, unknown>;
      const noItalianName = nika([NIKA_REVEAL]);
      noItalianName['initialKnowledge'] = {
        ...initial,
        translations: { it: { name: '' }, en: { name: 'Gum-Gum Fruit' } },
      };
      expect(incompleteLanguages(DEVIL_FRUIT, draftOf(noItalianName), LANGUAGES)).toEqual(['it']);
    });
  });

  describe('titled', () => {
    it('by its title, else by its point, else as new', () => {
      const [nikaReveal] = draftOf(nika()).reveals;

      expect(revealTitleOf(translate, nikaReveal, 'en')).toBe('The fruit is Nika');
      expect(revealTitleOf(translate, { ...nikaReveal, titles: {} }, 'en')).toContain(
        'content.reveals.untitled',
      );
      expect(revealTitleOf(translate, newReveal(LANGUAGES), 'en')).toBe('content.reveals.new');
    });
  });

  describe('compared', () => {
    it('shows every reveal as added against an empty content', () => {
      const compared = diffReveals(DEVIL_FRUIT, null, nika(), LANGUAGES);

      expect(compared.initial.map(({ field }) => field.field)).toEqual([
        'name',
        'name',
        'romaji',
        'type',
      ]);
      expect(compared.reveals).toHaveLength(1);
      expect(compared.reveals[0]).toMatchObject({ change: 'ADDED', position: 1 });
      expect(compared.reveals[0].named).toEqual({ before: [], after: ['NAME', 'ROMAJI', 'TYPE'] });
      // The last mention shows what the reader learns there: the current values.
      const fields = compared.reveals[0].rows.map(({ field }) => field.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          REVEALED_AT,
          REVEAL_TITLE,
          'name',
          'romaji',
          'type',
          'subcategory',
        ]),
      );
    });

    it('finds nothing between equal versions', () => {
      expect(diffReveals(DEVIL_FRUIT, nika(), nika(), LANGUAGES)).toEqual({
        initial: [],
        reveals: [],
      });
    });

    it('matches the reveals by position and lists only what changed', () => {
      const retitled = nika([{ ...NIKA_REVEAL, titles: { ...NIKA_REVEAL.titles, en: 'Nika!' } }]);

      const compared = diffReveals(DEVIL_FRUIT, nika(), retitled, LANGUAGES);

      expect(compared.reveals).toHaveLength(1);
      expect(compared.reveals[0].change).toBe('MODIFIED');
      expect(compared.reveals[0].named).toBeNull();
      expect(compared.reveals[0].rows).toEqual([
        expect.objectContaining({
          field: { field: REVEAL_TITLE, language: 'en' },
          before: 'The fruit is Nika',
          after: 'Nika!',
        }),
      ]);
    });

    it('reads a reveal removed from the base version', () => {
      const compared = diffReveals(DEVIL_FRUIT, nika(), nika([]), LANGUAGES);

      expect(compared.reveals.map(({ change }) => change)).toEqual(['REMOVED']);
    });
  });
});
