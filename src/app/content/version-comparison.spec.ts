import type { VersionStatus, VersionSummary } from './content.model';
import { countChanges, defaultBase, diffField, earlierVersions } from './version-comparison';

function version(number: number, basedOn: number | null, status: VersionStatus): VersionSummary {
  return {
    number,
    status,
    author: { id: 'u1', username: 'nami', email: 'nami@onepiece.local' },
    basedOn,
    claimant: null,
    everPublished: status !== 'DRAFT',
    allowedActions: [],
    overrideActions: [],
    createdAt: '2026-10-01T08:45:00Z',
    updatedAt: '2026-10-01T08:45:00Z',
  };
}

/** v1 superseded, v2 online from v1, v3 a draft opened again from v1. */
const CHAIN = [version(1, null, 'SUPERSEDED'), version(2, 1, 'PUBLISHED'), version(3, 1, 'DRAFT')];

describe('diffField', () => {
  it.each([
    ['added', null, 'Logia', 'ADDED'],
    ['removed', 'Logia', null, 'REMOVED'],
    ['modified', 'Logia', 'Rogia', 'MODIFIED'],
    ['unchanged', 'Logia', 'Logia', 'UNCHANGED'],
  ] as const)('marks a field %s', (_case, before, after, change) => {
    expect(diffField('name', before, after)).toEqual({ field: 'name', before, after, change });
  });

  it('treats a text of spaces like a missing one', () => {
    expect(diffField('name', '   ', 'Logia')?.change).toBe('ADDED');
    expect(diffField('name', 'Logia', '')?.change).toBe('REMOVED');
  });

  it('ignores spaces around a text', () => {
    expect(diffField('name', 'Logia ', ' Logia')).toEqual({
      field: 'name',
      before: 'Logia',
      after: 'Logia',
      change: 'UNCHANGED',
    });
  });

  it('leaves out a field absent on both sides', () => {
    expect(diffField('name', null, undefined)).toBeNull();
    expect(diffField('name', ' ', null)).toBeNull();
  });
});

describe('countChanges', () => {
  it('counts every kind of change, zero included', () => {
    const diffs = [
      diffField('a', null, 'x'),
      diffField('b', 'x', 'y'),
      diffField('c', 'x', 'y'),
      diffField('d', 'x', 'x'),
    ].filter((diff) => diff !== null);

    expect(countChanges(diffs)).toEqual({ ADDED: 1, REMOVED: 0, MODIFIED: 2, UNCHANGED: 1 });
  });
});

describe('earlierVersions', () => {
  it('offers the earlier versions, the most recent first', () => {
    expect(earlierVersions(CHAIN, 3).map((candidate) => candidate.number)).toEqual([2, 1]);
  });

  it('offers nothing for the first version', () => {
    expect(earlierVersions(CHAIN, 1)).toEqual([]);
  });

  it('offers only the versions the caller sees', () => {
    const reviewerChain = [CHAIN[0], version(3, 1, 'IN_REVIEW')];
    expect(earlierVersions(reviewerChain, 3).map((candidate) => candidate.number)).toEqual([1]);
  });
});

describe('defaultBase', () => {
  it('is the version it was opened from, not the previous one', () => {
    expect(defaultBase(CHAIN, 3)).toBe(1);
    expect(defaultBase(CHAIN, 2)).toBe(1);
  });

  it('is an empty content for the first version', () => {
    expect(defaultBase(CHAIN, 1)).toBeNull();
  });

  it('is an empty content when the version it was opened from is not in the chain', () => {
    expect(defaultBase([CHAIN[1], CHAIN[2]], 3)).toBeNull();
  });
});
