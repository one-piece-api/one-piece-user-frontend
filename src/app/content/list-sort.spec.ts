import { formatSort, nextSort, parseSort, type ListSort } from './list-sort';

type Field = 'name' | 'updatedAt';

const FIELDS: readonly Field[] = ['name', 'updatedAt'];
const DEFAULT: ListSort<Field> = { field: 'updatedAt', direction: 'desc' };

describe('list sort', () => {
  it('writes and reads a sort in the shape of the backend parameter', () => {
    expect(formatSort({ field: 'name', direction: 'asc' })).toBe('name,asc');
    expect(parseSort('name,desc', FIELDS)).toEqual({ field: 'name', direction: 'desc' });
  });

  it('reads anything else as no sort', () => {
    expect(parseSort(null, FIELDS)).toBeNull();
    expect(parseSort('romaji,asc', FIELDS)).toBeNull();
    expect(parseSort('name,up', FIELDS)).toBeNull();
    expect(parseSort('name', FIELDS)).toBeNull();
  });

  it('cycles a column ascending, descending, then back to the default', () => {
    const ascending = nextSort(null, 'name', DEFAULT);
    expect(ascending).toEqual({ field: 'name', direction: 'asc' });
    const descending = nextSort(ascending, 'name', DEFAULT);
    expect(descending).toEqual({ field: 'name', direction: 'desc' });
    expect(nextSort(descending, 'name', DEFAULT)).toBeNull();
  });

  it('starts another column ascending, whatever the current one', () => {
    expect(nextSort({ field: 'name', direction: 'desc' }, 'updatedAt', DEFAULT)).toEqual({
      field: 'updatedAt',
      direction: 'asc',
    });
  });

  it('flips the default column between its two directions, the default staying out of the URL', () => {
    const flipped = nextSort(null, 'updatedAt', DEFAULT);
    expect(flipped).toEqual({ field: 'updatedAt', direction: 'asc' });
    expect(nextSort(flipped, 'updatedAt', DEFAULT)).toBeNull();
  });
});
