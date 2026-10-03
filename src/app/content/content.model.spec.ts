import {
  actionLabelKey,
  contentSerial,
  editableVersion,
  localizedName,
  otherOnlineVersion,
  updatedMoment,
  versionToShow,
  type ContentSummary,
  type VersionSummary,
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
    allowedActions: [],
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

describe('versionToShow', () => {
  const chain = [1, 2, 3].map((number) => ({ number }) as VersionSummary);

  it('is the requested version when the chain has it', () => {
    expect(versionToShow(chain, 2)?.number).toBe(2);
  });

  it('is the most recent version when none is requested', () => {
    expect(versionToShow(chain, null)?.number).toBe(3);
  });

  it('is the most recent version when the requested one is not in the chain', () => {
    expect(versionToShow(chain, 7)?.number).toBe(3);
  });

  it('is nothing for an empty chain', () => {
    expect(versionToShow([], 1)).toBeNull();
  });
});

describe('actionLabelKey', () => {
  it('calls a new version from an archived one reopening it', () => {
    expect(actionLabelKey('OPEN_NEW_VERSION', 'ARCHIVED')).toBe('content.action.reopenArchived');
  });

  it('names every other action the same whatever the status', () => {
    expect(actionLabelKey('OPEN_NEW_VERSION', 'PUBLISHED')).toBe('content.action.openNewVersion');
    expect(actionLabelKey('PUBLISH', 'READY_TO_PUBLISH')).toBe('content.action.publish');
  });
});

describe('contentSerial', () => {
  it('is the first block of the id, in capitals', () => {
    expect(contentSerial('3f2a9c1b-0000-4000-8000-000000000001')).toBe('#3F2A9C1B');
  });
});

describe('editableVersion', () => {
  function link(number: number, allowedActions: VersionSummary['allowedActions']): VersionSummary {
    return {
      number,
      status: number === 2 ? 'DRAFT' : 'PUBLISHED',
      author: { id: 'u1', username: 'nami', email: 'nami@onepiece.local' },
      basedOn: null,
      claimant: null,
      everPublished: number !== 2,
      allowedActions,
      createdAt: '2026-10-01T08:45:00Z',
      updatedAt: '2026-10-01T08:45:00Z',
    };
  }

  it('is the version the backend lets the caller edit', () => {
    const chain = [link(1, ['OPEN_NEW_VERSION']), link(2, ['EDIT', 'DELETE', 'SUBMIT'])];

    expect(editableVersion(chain)?.number).toBe(2);
  });

  it('is nothing when the caller may edit no version', () => {
    expect(editableVersion([link(1, []), link(2, [])])).toBeNull();
  });
});
