import { NOTE, NOTE_IN_FOLDER } from '../../testing/note-entity';
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

  describe('with a field that points to another content', () => {
    const folder = { id: 'f1', romaji: 'Cartella', names: { it: 'Cartella' } };
    const filed = { ...note, folder };

    it('starts the draft with the whole reference, or none', () => {
      expect(draftOf(NOTE_IN_FOLDER, filed, ['it'])['folder']).toBe(folder);
      expect(draftOf(NOTE_IN_FOLDER, null, ['it'])['folder']).toBeNull();
    });

    it('saves the id of the reference, not the reference', () => {
      const body = toBody(NOTE_IN_FOLDER, draftOf(NOTE_IN_FOLDER, filed, ['it', 'en']));

      expect(body['folder']).toBe('f1');
      expect(toBody(NOTE_IN_FOLDER, draftOf(NOTE_IN_FOLDER, note, ['it']))['folder']).toBeNull();
    });

    it('asks for the reference with the shared fields, and sees a missing one', () => {
      const done = (body: object) =>
        readinessChecks(NOTE_IN_FOLDER, draftOf(NOTE_IN_FOLDER, body as never, ['it']), ['it'])
          .filter(({ field }) => field === 'folder')
          .map(({ language, done }) => `${language}:${done}`);

      expect(done(filed)).toEqual(['null:true']);
      expect(done(note)).toEqual(['null:false']);
    });

    it('addresses a refusal of the backend on the relation by its key', () => {
      expect(draftFieldKey(NOTE_IN_FOLDER, 'folder')).toBe('folder');
    });

    it('compares the relation after the other shared fields, once added', () => {
      const diffs = diffBodies(NOTE_IN_FOLDER, note, filed as never, ['it', 'en']);

      expect(diffs.at(-1)).toMatchObject({
        field: { field: 'folder', language: null },
        change: 'ADDED',
        after: 'Cartella',
      });
    });
  });
});
