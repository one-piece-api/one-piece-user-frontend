import {
  NOTE,
  NOTE_IN_FOLDER,
  NOTE_ON_TIMELINE,
  NOTE_WITH_PICTURE,
} from '../../testing/note-entity';
import { storyPointField } from './entity-definition';
import {
  imageField,
  localizedTextField,
  numberField,
  releaseListField,
  type EntityDefinition,
} from './entity-definition';
import {
  diffBodies,
  draftFieldKey,
  draftOf,
  isTranslationComplete,
  namesOf,
  readinessChecks,
  toBody,
  uploadOf,
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

  it('reads a story point refused by its chapter as the field itself', () => {
    const timed = { ...NOTE, fields: [...NOTE.fields, storyPointField('firstAppearance')] };

    expect(draftFieldKey(timed, 'firstAppearance.chapter')).toBe('firstAppearance');
    expect(draftFieldKey(timed, 'firstAppearance')).toBe('firstAppearance');
    expect(draftFieldKey(NOTE, 'firstAppearance.chapter')).toBeNull();
  });

  it('reads a time refused by its chapter or its world date as the field itself', () => {
    expect(draftFieldKey(NOTE_ON_TIMELINE, 'occursAt.chapter')).toBe('occursAt');
    expect(draftFieldKey(NOTE_ON_TIMELINE, 'occursAt.worldDate.yearFrom')).toBe('occursAt');
    expect(draftFieldKey(NOTE_ON_TIMELINE, 'endsAt.worldDate')).toBe('endsAt');
    expect(draftFieldKey(NOTE_ON_TIMELINE, 'endsAt')).toBe('endsAt');
    expect(draftFieldKey(NOTE, 'occursAt.worldDate')).toBeNull();
  });

  it('asks review for when it happens, never for an end', () => {
    const draft = draftOf(NOTE_ON_TIMELINE, null, ['en']);

    expect(
      readinessChecks(NOTE_ON_TIMELINE, draft, ['en'])
        .filter(({ language }) => language === null)
        .map(({ field }) => field),
    ).toEqual(['romaji', 'code', 'occursAt']);
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

  describe('with an image', () => {
    const picture = { id: 'a1b2', url: '/api/content/images/a1b2' };
    const pictured = { ...note, picture };
    const file = new File([new Uint8Array(4)], 'memo.png', { type: 'image/png' });
    const languages = ['it', 'en'];
    const draftFrom = (body: object | null) => draftOf(NOTE_WITH_PICTURE, body as never, languages);

    it('starts the draft with the saved image to keep, or none', () => {
      expect(draftFrom(pictured)['picture']).toEqual({ saved: picture });
      expect(draftFrom(null)['picture']).toBeNull();
    });

    it('leaves the image out of the JSON and of the review checklist', () => {
      const draft = draftFrom(pictured);

      expect(toBody(NOTE_WITH_PICTURE, draft)).not.toHaveProperty('picture');
      expect(
        readinessChecks(NOTE_WITH_PICTURE, draft, languages).map(({ field }) => field),
      ).not.toContain('picture');
    });

    it('sends nothing about an image kept, and no flag', () => {
      const upload = uploadOf(NOTE_WITH_PICTURE, draftFrom(pictured), pictured as never);

      expect(upload.file).toBeNull();
      expect(upload.body).not.toHaveProperty('removeImage');
    });

    it('sends a file chosen beside the JSON, in the part named after the field', () => {
      const draft = { ...draftFrom(pictured), picture: { chosen: file, preview: 'blob:x' } };
      const upload = uploadOf(NOTE_WITH_PICTURE, draft, pictured as never);

      expect(upload.file).toEqual({ part: 'picture', file });
      expect(upload.body).not.toHaveProperty('removeImage');
      expect(upload.body['romaji']).toBe('Memo');
    });

    it('asks to remove an image the saved version had and the draft dropped', () => {
      const draft = { ...draftFrom(pictured), picture: null };

      expect(uploadOf(NOTE_WITH_PICTURE, draft, pictured as never)).toMatchObject({
        file: null,
        body: { removeImage: true },
      });
    });

    it('asks to remove nothing on a content that never had an image', () => {
      expect(uploadOf(NOTE_WITH_PICTURE, draftFrom(null), null).body).not.toHaveProperty(
        'removeImage',
      );
      expect(uploadOf(NOTE_WITH_PICTURE, draftFrom(note), note as never).body).not.toHaveProperty(
        'removeImage',
      );
    });

    it('compares the images by id and shows their URLs', () => {
      const diffs = diffBodies(NOTE_WITH_PICTURE, note as never, pictured as never, languages);

      expect(diffs.at(-1)).toMatchObject({
        field: { field: 'picture', language: null },
        change: 'ADDED',
        before: null,
        after: picture.url,
      });
    });
  });
});

const COVER = {
  width: 40,
  height: 20,
  ratioTolerance: 0.1,
  maxBytes: 1000,
  maxPixels: 10_000,
  minTransparentPercent: 0,
};

describe('the body of an entity with optional fields and a number as its natural key', () => {
  const issue: EntityDefinition = {
    entityType: 'ISSUE',
    naturalKey: 'number',
    labelField: 'title',
    route: '/content/issues',
    api: '/api/content/issues',
    i18n: 'content.issues',
    icon: '#',
    fields: [
      numberField('number'),
      localizedTextField('title', { maxLength: 20 }),
      localizedTextField('subtitle', { maxLength: 20, optional: true }),
      numberField('pages', { min: 1, optional: true }),
      releaseListField('releases'),
    ],
  };
  const languages = ['it'];

  it('names a version by its labelField', () => {
    const body = { number: 3, translations: { it: { title: 'Alba', subtitle: 'x' }, en: {} } };

    expect(namesOf(issue, body)).toEqual({ it: 'Alba' });
  });

  it('asks review only for what is not optional', () => {
    const draft = draftOf(issue, null, languages);

    expect(readinessChecks(issue, draft, languages)).toEqual([
      { field: 'number', language: null, done: false },
      { field: 'title', language: 'it', done: false },
    ]);
    expect(isTranslationComplete(issue, { title: 'Alba', subtitle: '' })).toBe(true);
  });

  it('saves the releases sorted without the incomplete ones, and a number as a number', () => {
    const draft = draftOf(issue, null, languages);
    draft['number'] = '3';
    draft['pages'] = '';
    draft['releases'] = [
      { key: 'a', country: 'US', date: '1999-01-01' },
      { key: 'b', country: 'JP', date: '1997-10-20' },
      { key: 'c', country: '', date: '2000-01-01' },
    ];

    expect(toBody(issue, draft)).toMatchObject({
      number: 3,
      pages: null,
      releases: [
        { country: 'JP', date: '1997-10-20' },
        { country: 'US', date: '1999-01-01' },
      ],
    });
  });

  it('removes an image with the same flag whatever the field is called', () => {
    const covered: EntityDefinition = {
      ...issue,
      fields: [...issue.fields, imageField('cover', COVER)],
    };
    const draft = { ...draftOf(covered, null, languages), cover: null };
    const saved = { number: 1, cover: { id: 'c1', url: '/c1' }, translations: {} };

    expect(uploadOf(covered, draft, saved).body).toMatchObject({ removeImage: true });
  });

  it('addresses the errors of any translated field as the editor does', () => {
    expect(draftFieldKey(issue, 'translations[it].title')).toBe('it.title');
    expect(draftFieldKey(issue, 'number')).toBe('number');
  });

  it('compares the releases as one text, an entry per line', () => {
    const before = { number: 1, translations: {} };
    const after = { ...before, releases: [{ country: 'JP', date: '1997-10-20' }] };

    expect(diffBodies(issue, before, after, languages).at(-1)).toMatchObject({
      field: { field: 'releases', language: null },
      change: 'ADDED',
      after: 'JP 1997-10-20',
    });
  });
});
