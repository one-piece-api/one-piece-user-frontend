import {
  localizedName,
  otherOnlineVersion,
  updatedMoment,
  type ContentSummary,
} from './content.model';

function row(versionNumber: number, onlineVersionNumber: number | null): ContentSummary<unknown> {
  return {
    id: 'c1',
    versionNumber,
    status: 'DRAFT',
    author: { id: 'u1', username: 'nami', email: 'nami@onepiece.local' },
    updatedAt: '2026-10-01T08:45:00Z',
    onlineVersionNumber,
    body: null,
  };
}

describe('otherOnlineVersion', () => {
  it('is the online version when the row shows a different one', () => {
    expect(otherOnlineVersion(row(3, 2))).toBe(2);
  });

  it('is nothing when the row already shows the online version', () => {
    expect(otherOnlineVersion(row(2, 2))).toBeNull();
  });

  it('is nothing when nothing is online', () => {
    expect(otherOnlineVersion(row(1, null))).toBeNull();
  });
});

describe('localizedName', () => {
  it('prefers the name in the active language', () => {
    expect(localizedName({ it: 'Zoo Zoo', en: 'Zoan' }, 'en')).toBe('Zoan');
  });

  it('falls back to another language when the active one has no name', () => {
    expect(localizedName({ it: 'Zoo Zoo' }, 'en')).toBe('Zoo Zoo');
  });

  it('is nothing when no language has a name', () => {
    expect(localizedName({}, 'it')).toBeNull();
  });
});

describe('updatedMoment', () => {
  // Local-time instants on purpose: the buckets follow the viewer's own calendar day.
  const now = new Date(2026, 9, 1, 10, 0);

  it('says "today" for the same calendar day', () => {
    const moment = updatedMoment(new Date(2026, 9, 1, 8, 45).toISOString(), now, 'it');
    expect(moment).toEqual({ kind: 'today', time: '08:45' });
  });

  it('says "yesterday" for the day before, however few hours ago', () => {
    const moment = updatedMoment(new Date(2026, 8, 30, 23, 50).toISOString(), now, 'it');
    expect(moment).toEqual({ kind: 'yesterday', time: '23:50' });
  });

  it('gives day and month for an older date of the same year', () => {
    const moment = updatedMoment(new Date(2026, 7, 20, 10, 0).toISOString(), now, 'it');
    expect(moment).toEqual({ kind: 'date', date: '20/08', time: '10:00' });
  });

  it('adds the year when it is not the current one', () => {
    const moment = updatedMoment(new Date(2025, 11, 31, 9, 5).toISOString(), now, 'it');
    expect(moment).toEqual({ kind: 'date', date: '31/12/2025', time: '09:05' });
  });
});
