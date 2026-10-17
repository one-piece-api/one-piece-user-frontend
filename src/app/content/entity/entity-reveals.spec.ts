import { DEVIL_FRUIT } from '../devil-fruits/devil-fruit.model';
import { draftOf, toBody } from './entity-body';
import {
  forwardTimeline,
  INITIAL_NODE,
  isLastMention,
  orderedReveals,
  readerViewAt,
  revealRefusalOf,
  revealsDraftOf,
  revealsOfDraft,
  revealsSaved,
  withRevealedField,
  newReveal,
  type Belief,
  type RevealDraft,
  type TimelineNode,
} from './entity-reveals';

const LANGUAGES = ['it', 'en'];

const chapter = (number: number, title: string) => ({
  id: `chapter-${number}`,
  number,
  names: { it: title, en: title },
});
const PARAMECIA = { id: 'paramecia', romaji: 'Paramecia', names: { it: 'Paramecia' } };
const ZOAN = { id: 'zoan', romaji: 'Zoan', names: { it: 'Zoan' } };
const MYTHICAL = { id: 'mythical', names: { it: 'Mitologico' } };

/**
 * The reference case of the backend (`GomuGomuReveals`, T13), as the API shows it: met at
 * chapter 1 as the Gomu Gomu no Mi, a Paramecia; a body of rubber at chapter 100; the truth
 * at chapter 1044. The advantages are never revealed.
 */
const GOMU_GOMU = {
  romaji: 'Hito Hito no Mi, Model: Nika',
  type: ZOAN,
  subcategory: MYTHICAL,
  firstAppearance: { chapter: chapter(1, 'Romance Dawn') },
  translations: {
    it: {
      name: 'Frutto Homo Homo, modello Nika',
      description: 'Il frutto del dio del sole',
      advantages: 'Libera chi lo mangia',
      disadvantages: 'Stanca',
    },
    en: {
      name: 'Human-Human Fruit, Model: Nika',
      description: 'The fruit of the sun god',
      advantages: 'Frees its eater',
      disadvantages: 'Tiring',
    },
  },
  initialKnowledge: {
    romaji: 'Gomu Gomu no Mi',
    type: PARAMECIA,
    subcategory: null,
    translations: {
      it: { name: 'Frutto Gom Gom', description: 'Gomma, niente di più' },
      en: { name: 'Gum-Gum Fruit', description: 'Rubber, nothing more' },
    },
  },
  // Kept by the backend in chapter order; listed here backwards to check the order is not trusted.
  reveals: [
    {
      revealedAt: { chapter: chapter(1044, 'Il guerriero della liberazione') },
      fields: ['name', 'romaji', 'type', 'description', 'disadvantages'],
      titles: { it: 'Il frutto è Nika', en: 'The fruit is Nika' },
      translations: {},
    },
    {
      revealedAt: { chapter: chapter(100, 'Inizio della leggenda') },
      fields: ['description'],
      titles: { it: 'Un corpo di gomma', en: 'A body of rubber' },
      translations: {
        it: { description: 'Un corpo di gomma' },
        en: { description: 'A body of rubber' },
      },
    },
  ],
};

describe('the reveals of a content, read forward', () => {
  const draft = () => draftOf(DEVIL_FRUIT, GOMU_GOMU as never, LANGUAGES);

  it('holds the initial knowledge and each reveal as the API keeps them', () => {
    const reveals = revealsOfDraft(draft());

    expect(reveals.initial['romaji']).toBe('Gomu Gomu no Mi');
    expect(reveals.initial['type']).toEqual(PARAMECIA);
    expect(reveals.initial.translations['en']['description']).toBe('Rubber, nothing more');
    expect(reveals.initial.translations['en']['disadvantages']).toBe('');
    expect(reveals.reveals.map(({ chapter }) => chapter?.number)).toEqual([1044, 100]);
    expect(reveals.reveals[0].fields).toEqual([
      'romaji',
      'type',
      'name',
      'description',
      'disadvantages',
    ]);
    expect(reveals.reveals[1].titles).toEqual({ it: 'Un corpo di gomma', en: 'A body of rubber' });
  });

  it('starts empty for a new content', () => {
    expect(revealsDraftOf(DEVIL_FRUIT, null, LANGUAGES).reveals).toEqual([]);
  });

  it('orders reveals by chapter, those without one last in the order they were added', () => {
    const at = (key: string, number: number | null): RevealDraft => ({
      key,
      chapter: number === null ? null : chapter(number, ''),
      titles: {},
      fields: [],
      values: { translations: {} },
    });

    const ordered = orderedReveals([at('a', null), at('b', 50), at('c', null), at('d', 10)]);

    expect(ordered.map(({ key }) => key)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('tells the last mention of a field', () => {
    const ordered = orderedReveals(revealsOfDraft(draft()).reveals);

    expect(isLastMention(ordered, 0, 'description')).toBe(false);
    expect(isLastMention(ordered, 1, 'description')).toBe(true);
  });

  it('saves in chapter order, a value only where a later reveal changes the field again', () => {
    const body = toBody(DEVIL_FRUIT, draft());
    const reveals = body['reveals'] as Record<string, unknown>[];

    expect(reveals.map(({ revealedAt }) => revealedAt)).toEqual([
      { chapter: 'chapter-100' },
      { chapter: 'chapter-1044' },
    ]);
    expect(reveals[0]['translations']).toEqual({
      it: { description: 'Un corpo di gomma' },
      en: { description: 'A body of rubber' },
    });
    // Every field of the last reveal is its last mention: it reveals the truth, no value sent.
    expect(reveals[1]).not.toHaveProperty('romaji');
    expect(reveals[1]).not.toHaveProperty('type');
    expect(reveals[1]['translations']).toEqual({});
    expect(reveals[1]['titles']).toEqual({ it: 'Il frutto è Nika', en: 'The fruit is Nika' });
  });

  it('saves initial values only for the fields some reveal names', () => {
    const initial = toBody(DEVIL_FRUIT, draft())['initialKnowledge'];

    expect(initial).toEqual({
      romaji: 'Gomu Gomu no Mi',
      type: 'paramecia',
      subcategory: null,
      translations: {
        it: { name: 'Frutto Gom Gom', description: 'Gomma, niente di più', disadvantages: null },
        en: { name: 'Gum-Gum Fruit', description: 'Rubber, nothing more', disadvantages: null },
      },
    });
  });

  it('keeps a value typed on a mention that becomes the last, without sending it', () => {
    const reveals = revealsOfDraft(draft());
    const moved: RevealDraft[] = reveals.reveals.map((reveal) =>
      reveal.chapter?.number === 100 ? { ...reveal, chapter: chapter(2000, '') } : reveal,
    );

    const saved = revealsSaved(DEVIL_FRUIT, { ...reveals, reveals: moved });
    const sent = saved['reveals'] as Record<string, unknown>[];

    expect(
      moved.find(({ chapter }) => chapter?.number === 2000)?.values.translations['it'],
    ).toEqual(expect.objectContaining({ description: 'Un corpo di gomma' }));
    expect(sent[1]['translations']).toEqual({});
  });

  it('drops blank titles and trims the others', () => {
    const reveals = revealsOfDraft(draft());
    const retitled = reveals.reveals.map((reveal) => ({
      ...reveal,
      titles: { it: '  Gomma  ', en: '   ' },
    }));

    const sent = revealsSaved(DEVIL_FRUIT, { ...reveals, reveals: retitled })['reveals'] as Record<
      string,
      unknown
    >[];

    expect(sent[0]['titles']).toEqual({ it: 'Gomma' });
  });

  describe('the timeline', () => {
    const timeline = () => {
      const fruit = draft();
      return {
        truth: fruit as unknown as Belief,
        nodes: forwardTimeline(
          DEVIL_FRUIT,
          fruit as unknown as Belief,
          revealsOfDraft(fruit),
          fruit['firstAppearance'],
        ),
      };
    };
    const revealNode = (nodes: TimelineNode[], index: number) => {
      const node = nodes[index];
      if (node.kind !== 'reveal') {
        throw new Error(`node ${index} is a ${node.kind}`);
      }
      return node;
    };

    it('reads first appearance, then each reveal in chapter order', () => {
      const { nodes } = timeline();

      expect(nodes.map(({ kind }) => kind)).toEqual(['firstAppearance', 'reveal', 'reveal']);
      expect(nodes[0]).toMatchObject({
        chapter: { number: 1 },
        fields: ['romaji', 'type', 'name', 'description', 'disadvantages'],
      });
      expect(revealNode(nodes, 1).reveal.chapter?.number).toBe(100);
    });

    it('shows an intermediate reveal from the initial knowledge to the value learned', () => {
      const { nodes } = timeline();
      const [row] = revealNode(nodes, 1).rows;

      expect(row.field).toBe('description');
      expect(row.last).toBe(false);
      expect(row.before.translations['en']['description']).toBe('Rubber, nothing more');
      expect(row.after.translations['en']['description']).toBe('A body of rubber');
    });

    it('shows the last reveal of a field reaching the truth from the previous value', () => {
      const { nodes, truth } = timeline();
      const rows = revealNode(nodes, 2).rows;
      const description = rows.find(({ field }) => field === 'description');
      const disadvantages = rows.find(({ field }) => field === 'disadvantages');

      expect(description?.last).toBe(true);
      expect(description?.before.translations['en']['description']).toBe('A body of rubber');
      expect(description?.after).toBe(truth);
      // Not known before: the initial knowledge has no value for it.
      expect(disadvantages?.before.translations['en']['disadvantages']).toBe('');
    });
  });

  describe('the reader view', () => {
    const at = (point: number) => {
      const fruit = draftOf(DEVIL_FRUIT, GOMU_GOMU as never, LANGUAGES);
      return readerViewAt(
        DEVIL_FRUIT,
        GOMU_GOMU as never,
        fruit as unknown as Belief,
        revealsOfDraft(fruit),
        point,
      );
    };

    it('shows the initial knowledge at the first appearance', () => {
      const { body, unrevealed } = at(0);

      expect(body['romaji']).toBe('Gomu Gomu no Mi');
      expect(body['type']).toEqual(PARAMECIA);
      expect(body['subcategory']).toBeNull();
      expect(body.translations['it']['name']).toBe('Frutto Gom Gom');
      expect(body.translations['en']['description']).toBe('Rubber, nothing more');
      // Never revealed: the truth from the start.
      expect(body.translations['en']['advantages']).toBe('Frees its eater');
      // Revealed later, not known at first: nothing to show yet.
      expect(body.translations['en']['disadvantages']).toBe('');
      expect(unrevealed).toEqual(['disadvantages']);
    });

    it('shows the value learned at an intermediate reveal, the rest as before', () => {
      const { body, unrevealed } = at(1);

      expect(body.translations['en']['description']).toBe('A body of rubber');
      expect(body['romaji']).toBe('Gomu Gomu no Mi');
      expect(unrevealed).toEqual(['disadvantages']);
    });

    it('shows the truth after the last reveal', () => {
      const { body, unrevealed } = at(2);

      expect(body['romaji']).toBe('Hito Hito no Mi, Model: Nika');
      expect(body['type']).toEqual(ZOAN);
      expect(body['subcategory']).toEqual(MYTHICAL);
      expect(body.translations['en']['description']).toBe('The fruit of the sun god');
      expect(body.translations['en']['disadvantages']).toBe('Tiring');
      expect(unrevealed).toEqual([]);
    });

    it('keeps what is not revealed as it is', () => {
      expect(at(0).body['firstAppearance']).toEqual(GOMU_GOMU.firstAppearance);
    });
  });

  describe('a field added to a reveal', () => {
    // A fruit with no reveal yet: what the reader knew is still empty.
    const fresh = () => {
      const fruit = draftOf(
        DEVIL_FRUIT,
        { ...GOMU_GOMU, initialKnowledge: null, reveals: [] } as never,
        LANGUAGES,
      );
      const reveal = newReveal(LANGUAGES);
      return {
        truth: fruit as unknown as Belief,
        reveals: { ...revealsOfDraft(fruit), reveals: [reveal] },
        key: reveal.key,
      };
    };

    it('takes the value known so far as what the reader knew before', () => {
      const { truth, reveals, key } = fresh();

      const added = withRevealedField(DEVIL_FRUIT, reveals, key, 'description', truth);

      expect(added.reveals[0].fields).toEqual(['description']);
      expect(added.initial.translations['en']['description']).toBe('The fruit of the sun god');
    });

    it('takes a relation with its subcategory', () => {
      const { truth, reveals, key } = fresh();

      const added = withRevealedField(DEVIL_FRUIT, reveals, key, 'type', truth);

      expect(added.initial['type']).toEqual(ZOAN);
      expect(added.initial['subcategory']).toEqual(MYTHICAL);
    });

    it('keeps what was already written before', () => {
      const reveals = revealsOfDraft(draft());
      const reveal = newReveal(LANGUAGES);
      const withNew = {
        ...reveals,
        reveals: [...reveals.reveals, { ...reveal, chapter: chapter(2000, '') }],
      };

      const added = withRevealedField(
        DEVIL_FRUIT,
        withNew,
        reveal.key,
        'description',
        draft() as unknown as Belief,
      );

      expect(added.initial).toBe(withNew.initial);
    });
  });

  describe('a refusal of the backend', () => {
    const sent = ['reveal-a', 'reveal-b'];

    it('lands on the initial knowledge', () => {
      expect(revealRefusalOf('initialKnowledge.translations[it].name', sent)).toEqual({
        node: INITIAL_NODE,
        target: 'it.name',
      });
      expect(revealRefusalOf('initialKnowledge', sent)).toEqual({
        node: INITIAL_NODE,
        target: 'node',
      });
    });

    it('lands on the reveal sent at that position', () => {
      expect(revealRefusalOf('reveals[1].revealedAt.chapter', sent)).toEqual({
        node: 'reveal-b',
        target: 'chapter',
      });
      expect(revealRefusalOf('reveals[0].titles[en]', sent)).toEqual({
        node: 'reveal-a',
        target: 'title.en',
      });
      expect(revealRefusalOf('reveals[0].fields', sent)).toEqual({
        node: 'reveal-a',
        target: 'fields',
      });
      expect(revealRefusalOf('reveals[1].type', sent)).toEqual({
        node: 'reveal-b',
        target: 'type',
      });
      expect(revealRefusalOf('reveals[0]', sent)).toEqual({ node: 'reveal-a', target: 'node' });
    });

    it('is not one of the reveals otherwise', () => {
      expect(revealRefusalOf('reveals[5].fields', sent)).toBeNull();
      expect(revealRefusalOf('romaji', sent)).toBeNull();
    });
  });
});
