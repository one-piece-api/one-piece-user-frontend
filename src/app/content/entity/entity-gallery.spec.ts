import { CHARACTER } from '../characters/character.model';
import { CHAPTER_1, CHAPTER_8, CREWMATES } from '../../testing/part-list-entity';
import {
  AT_FIRST_APPEARANCE,
  draftOf,
  GALLERY_FILES_PART,
  readinessChecks,
  uploadOf,
  type EntityBody,
  type EntityDraft,
} from './entity-body';
import type { PartListField } from './entity-definition';
import { imagePartOf, mainPortraitIndex, meetsCondition } from './entity-gallery';
import type { PartEntryDraft } from './entity-part-list';

const LANGUAGES = ['it', 'en'];

const GALLERY = CHARACTER.fields.find(({ key }) => key === 'gallery') as PartListField;

type Kind = 'ASPETTO' | 'FORMA';

/** An image of a gallery as the API sends it, discovered at chapter 1, ended where given. */
function image(id: string, kind: Kind, ended: unknown = null) {
  return {
    image: { id, url: `/api/content/images/${id}` },
    kind,
    caption: { it: `${id} it`, en: `${id} en` },
    discovered: { chapter: CHAPTER_1 },
    ended,
  };
}

const ENDED = { chapter: CHAPTER_8 };

/** Luffy: before the timeskip (ended), after it, and Gear 5 - a form, never the portrait. */
const LUFFY = [image('pre', 'ASPETTO', ENDED), image('post', 'ASPETTO'), image('gear5', 'FORMA')];

function character(gallery: unknown[]): EntityBody {
  return {
    romaji: 'Monkey D. Luffy',
    firstAppearance: { chapter: CHAPTER_1 },
    gallery,
    translations: { it: { name: 'Rufy' }, en: { name: 'Luffy' } },
  };
}

function file(name: string): File {
  return new File(['bytes'], name, { type: 'image/webp' });
}

/** The draft with the image of entry `index` replaced by a file just chosen. */
function choose(draft: EntityDraft, index: number, chosen: File): EntityDraft {
  const entries = (draft['gallery'] as PartEntryDraft[]).map((entry, position) =>
    position === index
      ? { ...entry, values: { ...entry.values, image: { chosen, preview: 'blob:x' } } }
      : entry,
  );
  return { ...draft, gallery: entries };
}

describe('the main portrait of a gallery, read without a filter', () => {
  it('is the last appearance without an end: after the timeskip, not Gear 5', () => {
    expect(mainPortraitIndex(GALLERY, LUFFY)).toBe(1);
  });

  it('is the last of two current appearances, in list order', () => {
    expect(mainPortraitIndex(GALLERY, [image('a', 'ASPETTO'), image('b', 'ASPETTO')])).toBe(1);
  });

  it('falls back to the last appearance when every one has ended', () => {
    const ended = [image('a', 'ASPETTO', ENDED), image('b', 'ASPETTO', ENDED), image('f', 'FORMA')];
    expect(mainPortraitIndex(GALLERY, ended)).toBe(1);
  });

  it('is none when the gallery has only forms, or nothing', () => {
    expect(mainPortraitIndex(GALLERY, [image('f', 'FORMA')])).toBeNull();
    expect(mainPortraitIndex(GALLERY, [])).toBeNull();
  });

  it('reads the entries being written the same way', () => {
    const draft = draftOf(CHARACTER, character(LUFFY), LANGUAGES);
    expect(mainPortraitIndex(GALLERY, draft['gallery'] as unknown[])).toBe(1);
  });

  it('is none for a list that is no gallery', () => {
    const memberships = CREWMATES.fields.find(({ key }) => key === 'memberships');
    expect(mainPortraitIndex(memberships as PartListField, [{}])).toBeNull();
    expect(imagePartOf(memberships as PartListField)).toBeNull();
  });

  it('tells an appearance from a form by its kind', () => {
    const condition = { part: 'kind', equals: 'ASPETTO' };
    expect(meetsCondition(GALLERY, image('a', 'ASPETTO'), condition)).toBe(true);
    expect(meetsCondition(GALLERY, image('f', 'FORMA'), condition)).toBe(false);
    expect(imagePartOf(GALLERY)?.key).toBe('image');
  });
});

describe('a gallery on save', () => {
  it('names a kept image by its id and a chosen one by its upload number, in order', () => {
    const saved = character(LUFFY);
    const first = file('first.webp');
    const second = file('second.webp');
    const draft = choose(choose(draftOf(CHARACTER, saved, LANGUAGES), 0, first), 2, second);

    const upload = uploadOf(CHARACTER, draft, saved);

    expect(upload.files).toEqual([
      { part: GALLERY_FILES_PART, file: first },
      { part: GALLERY_FILES_PART, file: second },
    ]);
    const gallery = upload.body['gallery'] as Record<string, unknown>[];
    expect(gallery.map(({ upload: n, imageId }) => [n, imageId])).toEqual([
      [0, undefined],
      [undefined, 'post'],
      [1, undefined],
    ]);
    // The image part itself stays out of the JSON.
    expect(gallery.every((entry) => !('image' in entry))).toBe(true);
  });

  it('sends an entry without an image naming neither, for the backend to refuse on its row', () => {
    const draft = draftOf(CHARACTER, character([image('a', 'ASPETTO')]), LANGUAGES);
    const entry = (draft['gallery'] as PartEntryDraft[])[0];
    const withoutImage = {
      ...draft,
      gallery: [{ ...entry, values: { ...entry.values, image: null } }],
    };

    const upload = uploadOf(CHARACTER, withoutImage, null);

    expect(upload.files).toEqual([]);
    const sent = (upload.body['gallery'] as Record<string, unknown>[])[0];
    expect('upload' in sent || 'imageId' in sent).toBe(false);
  });
});

describe('a gallery before review', () => {
  function opening(gallery: unknown[]) {
    const draft = draftOf(CHARACTER, character(gallery), LANGUAGES);
    return readinessChecks(CHARACTER, draft, LANGUAGES).find(
      ({ field, entry }) => field === 'gallery' && entry?.part === AT_FIRST_APPEARANCE,
    );
  }

  it('asks for an appearance discovered at the first appearance', () => {
    expect(opening([image('a', 'ASPETTO')])?.done).toBe(true);
  });

  it('does not count a form there, nor an appearance discovered later', () => {
    const later = { ...image('b', 'ASPETTO'), discovered: { chapter: CHAPTER_8 } };
    expect(opening([image('f', 'FORMA'), later])?.done).toBe(false);
    expect(opening([])?.done).toBe(false);
  });
});
