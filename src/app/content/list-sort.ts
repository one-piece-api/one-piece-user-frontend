import type { SortDirection } from '../shared/ui/sort-header';

/** One column a list is sorted by, named as the backend's `sort` parameter names it. */
export interface ListSort<F extends string> {
  readonly field: F;
  readonly direction: SortDirection;
}

/** `name,asc` - the shape of both the page's query parameter and the backend's `sort`. */
export function formatSort<F extends string>(sort: ListSort<F>): string {
  return `${sort.field},${sort.direction}`;
}

/** Reads `name,asc` back, or `null` for anything that is not one of `fields` and a direction. */
export function parseSort<F extends string>(
  value: string | null,
  fields: readonly F[],
): ListSort<F> | null {
  const [field, direction] = (value ?? '').split(',');
  const isField = (fields as readonly string[]).includes(field);
  const isDirection = direction === 'asc' || direction === 'desc';
  return isField && isDirection ? { field: field as F, direction } : null;
}

/**
 * What a click on a column header asks for: ascending first, then descending, then back to the
 * list's default. The default is `null`, so it stays out of the URL; on the default's own column
 * the click simply flips the direction.
 */
export function nextSort<F extends string>(
  current: ListSort<F> | null,
  field: F,
  defaultSort: ListSort<F>,
): ListSort<F> | null {
  const shown = current ?? defaultSort;
  const orDefault = (next: ListSort<F>) =>
    next.field === defaultSort.field && next.direction === defaultSort.direction ? null : next;
  if (shown.field !== field) {
    return orDefault({ field, direction: 'asc' });
  }
  if (shown.direction === 'asc') {
    return orDefault({ field, direction: 'desc' });
  }
  // Descending: back to the default - unless this is the default already, then start over.
  return current === null ? orDefault({ field, direction: 'asc' }) : null;
}
