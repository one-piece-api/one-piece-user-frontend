import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { blockWords } from './block-words';

describe('blockWords', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
  });

  it('tells a fruit that its type is not online, with no one to point to', () => {
    const words = blockWords(transloco, {
      reason: 'TYPE_NOT_ONLINE',
      detail: { typeId: 't1', typeRomaji: 'Shizen-kei' },
    });

    expect(words.sentence).toBe("This fruit's type is not online. Republish the type first.");
    expect(words.note).toBe('Type not online');
    expect(words.links).toEqual([]);
    expect(words.titled).toBe(words.sentence);
  });

  it('tells a fruit that its subcategory is not online, naming it', () => {
    const words = blockWords(transloco, {
      reason: 'SUBCATEGORY_NOT_ONLINE',
      detail: {
        typeId: 't1',
        subcategoryId: 's2',
        subcategoryNames: { it: 'Mitologico', en: 'Mythical' },
      },
    });

    expect(words.note).toBe('Subcategory not online');
    expect(words.sentence).toContain('"Mythical"');
    expect(words.links).toEqual([]);
  });

  it('names the online fruits using a subcategory a type version leaves out', () => {
    const words = blockWords(transloco, {
      reason: 'SUBCATEGORY_IN_USE',
      detail: { count: 3, fruits: [{ id: 'f1', romaji: 'Uo Uo no Mi', subcategoryId: 's2' }] },
    });

    expect(words.note).toBe('Subcategory in use: 3');
    expect(words.links).toEqual([{ label: 'Uo Uo no Mi', route: '/content/devil-fruits/f1' }]);
    expect(words.more).toBe(2);
  });

  it('names the fruits that keep a type from being retired, each leading to its page', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_FRUITS_LINKED',
      detail: {
        count: 2,
        fruits: [
          { id: 'f1', romaji: 'Mera Mera no Mi' },
          { id: 'f2', romaji: null },
        ],
      },
    });

    expect(words.note).toBe('Fruits online: 2');
    expect(words.links).toEqual([
      { label: 'Mera Mera no Mi', route: '/content/devil-fruits/f1' },
      { label: 'f2', route: '/content/devil-fruits/f2' },
    ]);
    expect(words.more).toBe(0);
    expect(words.titled).toBe(
      'Fruits are online with this type, retire them first: Mera Mera no Mi, f2',
    );
  });

  it('says how many more there are than are named', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_FRUITS_LINKED',
      detail: { count: 8, fruits: [{ id: 'f1', romaji: 'Mera Mera no Mi' }] },
    });

    expect(words.more).toBe(7);
    expect(words.titled).toContain('Mera Mera no Mi and 7 more');
  });
});

describe('blockWords of the story contents', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
  });

  it('tells a content that the saga, arc or volume it points to is not online', () => {
    const volume = blockWords(transloco, {
      reason: 'RELATED_NOT_ONLINE',
      detail: { volumeId: 'v1', volumeNumber: 4 },
    });
    const saga = blockWords(transloco, {
      reason: 'RELATED_NOT_ONLINE',
      detail: { sagaId: 's1', sagaNumber: 1 },
    });

    expect(volume.note).toBe('Volume not online');
    expect(volume.sentence).toContain('volume');
    expect(volume.links).toEqual([]);
    expect(saga.note).toBe('Saga not online');
  });

  it('names, by number, the chapters that keep an arc from being retired', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 3, chapters: [{ id: 'c1', number: 12 }] },
    });

    expect(words.note).toBe('Chapters online: 3');
    expect(words.links).toEqual([{ label: '12', route: '/content/chapters/c1' }]);
    expect(words.more).toBe(2);
    expect(words.titled).toContain('12 and 2 more');
  });

  it('points the arcs that keep a saga from being retired to the arcs section', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 1, arcs: [{ id: 'a1', number: 0 }] },
    });

    expect(words.links).toEqual([{ label: '0', route: '/content/arcs/a1' }]);
  });

  it('tells a fruit or a type that the chapter of its first appearance is not online', () => {
    const words = blockWords(transloco, {
      reason: 'RELATED_NOT_ONLINE',
      detail: { firstAppearanceChapterId: 'c1', firstAppearanceChapterNumber: 1 },
    });

    expect(words.note).toBe('First appearance chapter not online');
    expect(words.links).toEqual([]);
  });

  it('names, by romaji, the fruits that keep a chapter from being retired', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 1, fruits: [{ id: 'f1', romaji: 'Gomu Gomu no Mi' }] },
    });

    expect(words.note).toBe('Fruits online: 1');
    expect(words.links).toEqual([{ label: 'Gomu Gomu no Mi', route: '/content/devil-fruits/f1' }]);
  });

  it('points the types that keep a chapter from being retired to the types section', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 1, types: [{ id: 't1', romaji: 'Shizen-kei' }] },
    });

    expect(words.links).toEqual([{ label: 'Shizen-kei', route: '/content/devil-fruit-types/t1' }]);
  });

  it('names, by romaji, the affiliations that keep a chapter or an episode from being retired', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 3, affiliations: [{ id: 'a1', romaji: 'Mugiwara no Ichimi' }] },
    });

    expect(words.note).toBe('Affiliations online: 3');
    expect(words.links).toEqual([
      { label: 'Mugiwara no Ichimi', route: '/content/affiliations/a1' },
    ]);
    expect(words.more).toBe(2);
    expect(words.titled).toBe(
      'Arrr! Online affiliations first appear here, matey. Retire them first: Mugiwara no Ichimi and 2 more',
    );
  });

  it('asks a fruit or a type for its first appearance before it goes online', () => {
    const words = blockWords(transloco, { reason: 'FIRST_APPEARANCE_MISSING', detail: {} });

    expect(words.note).toBe('First appearance missing');
    expect(words.links).toEqual([]);
    expect(words.titled).toBe(words.sentence);
  });
});

describe('blockWords of the bounties', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
  });

  it('tells a bounty that the one it replaces is not online', () => {
    const words = blockWords(transloco, {
      reason: 'RELATED_NOT_ONLINE',
      detail: { previousId: 'b0', previousKey: 'Monkey D. Luffy 30000000' },
    });

    expect(words.note).toBe('Previous bounty not online');
    expect(words.sentence).toContain('The bounty this one replaces is not online yet');
    expect(words.links).toEqual([]);
  });

  it('tells a content that the episode of its first appearance is not online', () => {
    const words = blockWords(transloco, {
      reason: 'RELATED_NOT_ONLINE',
      detail: { firstAppearanceEpisodeId: 'e1', firstAppearanceEpisodeNumber: 1 },
    });

    expect(words.note).toBe('First appearance episode not online');
    expect(words.sentence).toContain('episode');
  });

  it('names, by key, the online bounties that keep a bounty from being retired', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 2, bounties: [{ id: 'b2', key: 'Monkey D. Luffy 100000000' }] },
    });

    expect(words.note).toBe('Bounties online: 2');
    expect(words.links).toEqual([
      { label: 'Monkey D. Luffy 100000000', route: '/content/bounties/b2' },
    ]);
    expect(words.more).toBe(1);
  });

  it('leads to the bounty that already replaces the previous one', () => {
    const words = blockWords(transloco, {
      reason: 'PREVIOUS_ALREADY_REPLACED',
      detail: { previousId: 'b0', replacedBy: { id: 'b9', key: 'Monkey D. Luffy 100000000' } },
    });

    expect(words.note).toBe('Previous bounty already replaced');
    expect(words.links).toEqual([
      { label: 'Monkey D. Luffy 100000000', route: '/content/bounties/b9' },
    ]);
    expect(words.titled).toBe(`${words.sentence} Monkey D. Luffy 100000000`);
  });

  it('tells a bounty that its previous one would close the chain on itself', () => {
    const words = blockWords(transloco, {
      reason: 'BOUNTY_CHAIN_CYCLE',
      detail: { previousId: 'b0' },
    });

    expect(words.note).toBe('Circular bounty chain');
    expect(words.links).toEqual([]);
    expect(words.titled).toBe(words.sentence);
  });

  it('words every new reason in Italian too', () => {
    transloco.setActiveLang('it');

    const cycle = blockWords(transloco, {
      reason: 'BOUNTY_CHAIN_CYCLE',
      detail: { previousId: 'b0' },
    });

    expect(cycle.note).toBe('Catena di taglie circolare');
    expect(cycle.sentence).toContain('compare');
  });
});
