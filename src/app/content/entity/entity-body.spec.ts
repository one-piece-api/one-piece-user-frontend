import { NOTE } from '../../testing/note-entity';
import {
  diffBodies,
  draftFieldKey,
  draftOf,
  isTranslationComplete,
  readinessChecks,
  toBody,
} from './entity-body';

/**
 * The generic functions, run on an entity that exists only in the specs: everything comes
 * from its fields - nothing of the Devil Fruit Type.
 */
describe('the body of any entity', () => {
  const note = {
    romaji: 'Memo',
    code: 'N-1',
    translations: { it: { name: 'Nota', body: 'Testo.' }, en: { name: 'Note', body: null } },
  };

  it('starts a draft with every shared field and every translated one per language', () => {
    expect(draftOf(NOTE, null, ['it'])).toEqual({
      romaji: '',
      code: '',
      translations: { it: { name: '', body: '' } },
    });
  });

  it('saves every field the definition has, and only those', () => {
    const draft = draftOf(NOTE, note, ['it', 'en']);
    draft['code'] = ' N-2 ';
    draft.translations['en']['ignored'] = 'not a field';

    expect(toBody(NOTE, draft)).toEqual({
      romaji: 'Memo',
      code: 'N-2',
      translations: { it: { name: 'Nota', body: 'Testo.' }, en: { name: 'Note', body: null } },
    });
  });

  it('asks for the shared fields first, then the translated ones language by language', () => {
    const checks = readinessChecks(NOTE, draftOf(NOTE, note, ['it', 'en']), ['it', 'en']);

    expect(checks.map(({ field, language, done }) => `${field}.${language}:${done}`)).toEqual([
      'romaji.null:true',
      'code.null:true',
      'name.it:true',
      'body.it:true',
      'name.en:true',
      'body.en:false',
    ]);
  });

  it('calls a language complete when every translated field of the entity is filled in', () => {
    expect(isTranslationComplete(NOTE, note.translations.it)).toBe(true);
    expect(isTranslationComplete(NOTE, note.translations.en)).toBe(false);
  });

  it('reads the fields the backend names, by the keys of the entity', () => {
    expect(draftFieldKey(NOTE, 'code')).toBe('code');
    expect(draftFieldKey(NOTE, 'translations[it].body')).toBe('it.body');
    expect(draftFieldKey(NOTE, 'translations[it].description')).toBeNull();
  });

  it('compares the fields in the order the definition lists them', () => {
    const changed = {
      ...note,
      code: 'N-2',
      translations: { it: { name: 'Nota', body: 'Altro.' } },
    };

    expect(
      diffBodies(NOTE, note, changed, ['it', 'en']).map(
        ({ field, change }) => `${field.field}.${field.language}:${change}`,
      ),
    ).toEqual([
      'romaji.null:UNCHANGED',
      'name.it:UNCHANGED',
      'name.en:REMOVED',
      'body.it:MODIFIED',
      'code.null:MODIFIED',
    ]);
  });
});
