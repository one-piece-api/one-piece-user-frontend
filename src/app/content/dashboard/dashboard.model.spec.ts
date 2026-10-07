import {
  activityLink,
  activityName,
  activityStatus,
  activityVerbKey,
  hasMineScope,
  legendFor,
  mineTagKey,
  rowActions,
  rowNoteKey,
  statusPageOf,
  statusPageRoute,
  type Activity,
} from './dashboard.model';

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    action: 'VERSION_PUBLISHED',
    occurredAt: '2026-10-03T10:00:00Z',
    entityType: 'DEVIL_FRUIT_TYPE',
    contentId: 'c1',
    versionNumber: 2,
    label: 'Logia',
    title: { names: { it: 'Rogia', en: 'Logia' }, fallback: 'Shizen-kei' },
    ...overrides,
  };
}

describe('mineTagKey', () => {
  it('names the caller’s drafts and the reviews they hold', () => {
    expect(mineTagKey({ status: 'DRAFT', count: 4, mine: 2 })).toBe('content.dashboard.mineDrafts');
    expect(mineTagKey({ status: 'IN_REVIEW', count: 4, mine: 1 })).toBe(
      'content.dashboard.mineClaimed',
    );
  });

  it('says nothing when none is the caller’s, or the status has no "mine"', () => {
    expect(mineTagKey({ status: 'DRAFT', count: 4, mine: 0 })).toBeNull();
    expect(mineTagKey({ status: 'PUBLISHED', count: 4, mine: null })).toBeNull();
  });
});

describe('activityVerbKey', () => {
  it('has words for every audit action about a version', () => {
    expect(activityVerbKey('VERSION_PUBLISHED')).toBe(
      'content.dashboard.activity.verb.VERSION_PUBLISHED',
    );
    expect(activityVerbKey('VERSION_DELETED')).toBe(
      'content.dashboard.activity.verb.VERSION_DELETED',
    );
  });

  it('falls back to a generic verb for an action it does not know', () => {
    expect(activityVerbKey('SOMETHING_NEW')).toBe('content.dashboard.activity.verb.other');
  });
});

describe('activityStatus', () => {
  it('is where the action left the version', () => {
    expect(activityStatus('VERSION_SUBMITTED')).toBe('IN_REVIEW');
    expect(activityStatus('VERSION_RETIRED')).toBe('RETIRED');
  });

  it('is nothing for a discarded draft', () => {
    expect(activityStatus('VERSION_DELETED')).toBeNull();
  });
});

describe('activityName', () => {
  it('is the current name in the reader’s language, else in another one', () => {
    expect(activityName(activity(), 'it')).toBe('Rogia');
    expect(activityName(activity({ title: { names: { en: 'Logia' }, fallback: 'x' } }), 'it')).toBe(
      'Logia',
    );
  });

  it('is the fallback when no language has a name', () => {
    expect(activityName(activity({ title: { names: {}, fallback: 'Shizen-kei' } }), 'it')).toBe(
      'Shizen-kei',
    );
  });

  it('is what it was called back then once the caller no longer sees it', () => {
    expect(activityName(activity({ title: null, label: 'Paramecia' }), 'it')).toBe('Paramecia');
  });
});

describe('activityLink', () => {
  it('opens the content in its section', () => {
    expect(activityLink(activity())).toBe('/content/devil-fruit-types/c1');
  });

  it('leads nowhere once the caller no longer sees the content, or it is gone', () => {
    expect(activityLink(activity({ title: null }))).toBeNull();
    expect(activityLink(activity({ entityType: null, title: null }))).toBeNull();
  });

  it('leads nowhere for an entity the app has no pages for yet', () => {
    expect(activityLink(activity({ entityType: 'DEVIL_FRUIT' }))).toBeNull();
  });
});

describe('status pages', () => {
  it('names a status page by its slug, and nothing else', () => {
    expect(statusPageOf('in-review')?.status).toBe('IN_REVIEW');
    expect(statusPageOf('superseded')).toBeNull();
    expect(statusPageOf(null)).toBeNull();
  });

  it('leads to the page of a status, or to the overview for one with none', () => {
    expect(statusPageRoute('READY_TO_PUBLISH')).toBe('/dashboard/ready');
    expect(statusPageRoute('SUPERSEDED')).toBe('/dashboard');
  });

  it('opens Review to writers and reviewers, Draft to writers only', () => {
    expect(statusPageOf('in-review')?.anyPermission).toEqual(['content:write', 'content:review']);
    expect(statusPageOf('draft')?.anyPermission).toEqual(['content:write']);
  });

  it('has a "mine" for drafts and reviews only', () => {
    expect(hasMineScope('DRAFT')).toBe(true);
    expect(hasMineScope('IN_REVIEW')).toBe(true);
    expect(hasMineScope('PUBLISHED')).toBe(false);
  });
});

describe('rowActions', () => {
  it('offers claiming first and letting go last, as in the mockup', () => {
    expect(rowActions({ allowedActions: ['RELEASE', 'REJECT', 'APPROVE'] })).toEqual([
      'APPROVE',
      'REJECT',
      'RELEASE',
    ]);
    expect(rowActions({ allowedActions: ['DELETE', 'SUBMIT', 'EDIT'] })).toEqual([
      'EDIT',
      'SUBMIT',
      'DELETE',
    ]);
  });

  it('offers at most four', () => {
    const many = rowActions({
      allowedActions: ['EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT', 'RELEASE'],
    });
    expect(many).toHaveLength(4);
  });
});

describe('rowNoteKey', () => {
  const nami = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
  const zoro = { id: 'u2', username: 'zoro', email: 'zoro@onepiece.local' };

  it('says nothing when the row offers an action', () => {
    expect(
      rowNoteKey(
        { allowedActions: ['CLAIM'], status: 'IN_REVIEW', author: nami, claimant: null },
        'zoro',
      ),
    ).toBeNull();
  });

  it('tells the author their version waits for a reviewer', () => {
    expect(
      rowNoteKey({ allowedActions: [], status: 'IN_REVIEW', author: nami, claimant: null }, 'nami'),
    ).toBe('content.dashboard.note.awaitingReviewer');
  });

  it('says a review held by someone else is taken', () => {
    expect(
      rowNoteKey({ allowedActions: [], status: 'IN_REVIEW', author: nami, claimant: zoro }, 'law'),
    ).toBe('content.dashboard.note.busy');
  });

  it('names whose draft it is', () => {
    expect(
      rowNoteKey({ allowedActions: [], status: 'DRAFT', author: nami, claimant: null }, 'zoro'),
    ).toBe('content.dashboard.note.draftOf');
  });

  it('is read only otherwise', () => {
    expect(
      rowNoteKey({ allowedActions: [], status: 'PUBLISHED', author: nami, claimant: null }, 'zoro'),
    ).toBe('content.dashboard.note.readOnly');
  });
});

describe('legendFor', () => {
  it('describes the actions of the status the caller holds a permission for', () => {
    const reviewer = (permission: string) =>
      ['content:read', 'content:review'].includes(permission);
    expect(legendFor('IN_REVIEW', reviewer).map((entry) => entry.action)).toEqual([
      'CLAIM',
      'APPROVE',
      'REJECT',
      'RELEASE',
    ]);
  });

  it('is empty for whoever can only read', () => {
    expect(legendFor('PUBLISHED', (permission) => permission === 'content:read')).toEqual([]);
  });
});
