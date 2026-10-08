import { chosenFileOf, isImageDraft, isImageReference } from './entity-image';

describe('the image of a version', () => {
  const saved = { id: 'a1b2', url: '/api/content/images/a1b2' };
  const file = new File([new Uint8Array(4)], 'fruit.png', { type: 'image/png' });

  it('tells a saved image from an absent or malformed one', () => {
    expect(isImageReference(saved)).toBe(true);
    expect(isImageReference(null)).toBe(false);
    expect(isImageReference({ id: 'a1b2' })).toBe(false);
  });

  it('holds in the editor an image kept or a file chosen, nothing else', () => {
    expect(isImageDraft({ saved })).toBe(true);
    expect(isImageDraft({ chosen: file, preview: 'blob:x' })).toBe(true);
    expect(isImageDraft(null)).toBe(false);
    expect(isImageDraft({ saved: { id: 'a1b2' } })).toBe(false);
    expect(isImageDraft({ chosen: 'fruit.png' })).toBe(false);
  });

  it('gives the file still to send only for a file chosen', () => {
    expect(chosenFileOf({ chosen: file, preview: 'blob:x' })).toBe(file);
    expect(chosenFileOf({ saved })).toBeNull();
    expect(chosenFileOf(null)).toBeNull();
  });
});
