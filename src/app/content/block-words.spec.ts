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
