import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { choiceLabelKey } from '../entity/entity-part-list';
import { CHARACTER, RELATIVE_KINDS } from './character.model';

const GENDERS = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
const LANGUAGES = ['en', 'it'] as const;
const I18N = 'content.characters';

describe('the words for what a relative is', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
  });

  function translated(key: string, language: string): string {
    return transloco.translate(key, {}, language);
  }

  it.each(LANGUAGES)('has a neutral label and one per gender for every kind, in %s', (language) => {
    for (const kind of RELATIVE_KINDS) {
      const neutralKey = `${I18N}.options.kind.${kind}`;
      expect(translated(neutralKey, language), neutralKey).not.toBe(neutralKey);
      for (const gender of GENDERS) {
        const key = `${I18N}.relativeKinds.${kind}.${gender}`;
        expect(translated(key, language), key).not.toBe(key);
      }
    }
  });

  it('words a parent after the gender of the relative, in both languages', () => {
    const words = (language: string) =>
      GENDERS.map((gender) => translated(`${I18N}.relativeKinds.PARENT.${gender}`, language));

    expect(words('en')).toEqual(['Father', 'Mother', 'Parent']);
    expect(words('it')).toEqual(['Padre', 'Madre', 'Genitore']);
  });

  it('asks for the gendered label where the relative has a gender, else for the neutral one', () => {
    const list = CHARACTER.fields.find((field) => field.key === 'relatives');
    const kind =
      list?.kind === 'partList' ? list.parts.find((part) => part.key === 'kind') : undefined;
    if (list?.kind !== 'partList' || kind?.kind !== 'choice') {
      throw new Error('the relatives are a list with a kind');
    }
    const keyOf = (relative: unknown) =>
      choiceLabelKey(I18N, list, kind, 'PARENT', { relative, kind: 'PARENT' });

    expect(keyOf({ id: 'c1', gender: 'FEMALE' })).toBe(`${I18N}.relativeKinds.PARENT.FEMALE`);
    expect(keyOf({ id: 'c1' })).toBe(`${I18N}.options.kind.PARENT`);
    expect(keyOf(null)).toBe(`${I18N}.options.kind.PARENT`);
  });
});
