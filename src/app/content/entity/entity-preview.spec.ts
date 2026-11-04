import { axisOf, positionNumberOf, positionOf, previewUrl } from './entity-preview';

describe('the position of a preview, as the URL holds it', () => {
  it('accepts the two axes and nothing else', () => {
    expect(axisOf('chapter')).toBe('chapter');
    expect(axisOf('episode')).toBe('episode');
    expect(axisOf('CHAPTER')).toBeNull();
    expect(axisOf(undefined)).toBeNull();
  });

  it('accepts a whole number of 1 or more, even one that names no chapter', () => {
    expect(positionNumberOf('400')).toBe(400);
    expect(positionNumberOf(' 9999 ')).toBe(9999);
    expect(positionNumberOf('1')).toBe(1);
  });

  it.each(['0', '-3', '1.5', '12a', '', '  ', null, undefined])('refuses %j', (value) => {
    expect(positionNumberOf(value)).toBeNull();
  });

  it('needs both parts valid', () => {
    expect(positionOf('episode', '12')).toEqual({ axis: 'episode', number: 12 });
    expect(positionOf('episode', null)).toBeNull();
    expect(positionOf('page', '12')).toBeNull();
  });

  it('asks the backend for exactly one axis', () => {
    expect(
      previewUrl('/api/content/characters/c1/versions/2', { axis: 'chapter', number: 400 }),
    ).toBe('/api/content/characters/c1/versions/2/preview?asOfChapter=400');
    expect(previewUrl('/v/1', { axis: 'episode', number: 7 })).toBe('/v/1/preview?asOfEpisode=7');
  });
});
