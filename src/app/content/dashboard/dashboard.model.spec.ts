import {
  activityLink,
  activityName,
  activityStatus,
  activityVerbKey,
  mineTagKey,
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
});
