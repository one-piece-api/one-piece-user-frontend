import { COUNTRY_CODES, countryName, newReleaseKey, releasesOf } from './entity-release';

describe('the releases of a content', () => {
  it('lists the 249 ISO 3166-1 country codes, sorted and without repeats', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    expect([...COUNTRY_CODES].sort()).toEqual([...COUNTRY_CODES]);
    expect(COUNTRY_CODES).toContain('JP');
  });

  it('gives each draft entry a key of its own', () => {
    expect(newReleaseKey()).not.toBe(newReleaseKey());
  });

  it('reads the releases of a saved value, and none from anything else', () => {
    expect(releasesOf([{ country: 'JP', date: '1997-10-20' }, { country: 'IT' }, null])).toEqual([
      { country: 'JP', date: '1997-10-20' },
    ]);
    expect(releasesOf(undefined)).toEqual([]);
  });

  it('names a country in the language, falling back to the code for one it does not know', () => {
    expect(countryName('JP', 'en')).toBe('Japan');
    expect(countryName('JP', 'it')).toBe('Giappone');
    expect(countryName('not a code', 'en')).toBe('not a code');
  });
});
