import { HttpErrorResponse } from '@angular/common/http';
import {
  confirmsOverride,
  newVersionDoneKey,
  overriddenUser,
  routeTargetOf,
  transitionRefusal,
} from './version-transition';

function refused(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('transitionRefusal', () => {
  it('lists what an incomplete version still lacks', () => {
    const error = refused(422, {
      errorCode: 'CONTENT_VERSION_INCOMPLETE',
      errors: [
        { field: 'romaji', message: 'is required for review' },
        { field: 'translations[en].name', message: 'is required for review' },
      ],
    });

    expect(transitionRefusal(error)).toEqual({
      kind: 'incomplete',
      fields: ['romaji', 'translations[en].name'],
    });
  });

  it('lists the values another content holds', () => {
    const error = refused(422, {
      errorCode: 'CONTENT_VALUE_ALREADY_USED',
      errors: [{ field: 'translations[it].name', message: 'is already used by another content' }],
    });

    expect(transitionRefusal(error)).toEqual({ kind: 'taken', fields: ['translations[it].name'] });
  });

  it('names the public address another content already has', () => {
    const error = refused(422, {
      errorCode: 'CONTENT_SLUG_ALREADY_USED',
      slug: 'kumo-kumo',
      errors: [{ field: 'romaji', message: 'gives the public address of another content' }],
    });

    expect(transitionRefusal(error)).toEqual({ kind: 'slugTaken', slug: 'kumo-kumo' });
  });

  it('tells a romaji that gives no public address', () => {
    const error = refused(422, {
      errorCode: 'CONTENT_VALUE_INVALID',
      errors: [{ field: 'romaji', message: 'must contain a letter or a digit' }],
    });

    expect(transitionRefusal(error)).toEqual({ kind: 'noSlug' });
  });

  it('names the version a submission repeats', () => {
    const error = refused(422, { errorCode: 'CONTENT_VERSION_IDENTICAL', identicalTo: 1 });

    expect(transitionRefusal(error)).toEqual({ kind: 'identical', version: 1 });
  });

  it('reads a 409 the content gives for a reason as that reason, not as a version that moved', () => {
    const error = refused(409, {
      errorCode: 'CONTENT_VERSION_ACTION_BLOCKED',
      reason: 'ONLINE_FRUITS_LINKED',
      detail: { count: 1, fruits: [{ id: 'f1', romaji: 'Mera Mera no Mi' }] },
    });

    expect(transitionRefusal(error)).toEqual({
      kind: 'blocked',
      cause: {
        reason: 'ONLINE_FRUITS_LINKED',
        detail: { count: 1, fruits: [{ id: 'f1', romaji: 'Mera Mera no Mi' }] },
      },
    });
  });

  it('keeps a refusal for a reason it does not know, without its words', () => {
    const error = refused(409, {
      errorCode: 'CONTENT_VERSION_ACTION_BLOCKED',
      reason: 'SOMETHING_NEW',
      detail: {},
    });

    expect(transitionRefusal(error)).toEqual({ kind: 'blocked', cause: null });
  });

  it.each([403, 404, 409])('reads a %i as a version that moved in the meantime', (status) => {
    const error = refused(status, { errorCode: 'CONTENT_VERSION_ACTION_CONFLICT' });

    expect(transitionRefusal(error)).toEqual({ kind: 'stale' });
  });

  it('has nothing more to say about any other failure', () => {
    expect(transitionRefusal(refused(500, null))).toEqual({ kind: 'failed' });
    expect(transitionRefusal(new Error('offline'))).toEqual({ kind: 'failed' });
  });
});

describe('routeTargetOf', () => {
  it('offers a transition where it takes the version, and a new version on Draft', () => {
    expect(routeTargetOf('PUBLISH')).toBe('PUBLISHED');
    expect(routeTargetOf('OPEN_NEW_VERSION')).toBe('DRAFT');
  });

  it('offers archiving on Archived and recovering on Ready to publish', () => {
    expect(routeTargetOf('ARCHIVE')).toBe('ARCHIVED');
    expect(routeTargetOf('RECOVER')).toBe('READY_TO_PUBLISH');
  });

  it('offers retiring on Retired and republishing on Published', () => {
    expect(routeTargetOf('RETIRE')).toBe('RETIRED');
    expect(routeTargetOf('RESTORE')).toBe('PUBLISHED');
  });

  it('offers nothing for an action that does not move the version', () => {
    expect(routeTargetOf('EDIT')).toBeUndefined();
    expect(routeTargetOf('DELETE')).toBeUndefined();
  });
});

describe('newVersionDoneKey', () => {
  it('says an archived base stays in the history', () => {
    expect(newVersionDoneKey('ARCHIVED', 1)).toBe('content.workflow.done.reopened');
  });

  it('says which version stays online, when one is', () => {
    expect(newVersionDoneKey('SUPERSEDED', 2)).toBe('content.workflow.done.openedKeepingOnline');
    expect(newVersionDoneKey('RETIRED', null)).toBe('content.workflow.done.opened');
  });
});

describe('confirmsOverride', () => {
  it('asks first before acting on someone else’s version or claim', () => {
    for (const action of [
      'EDIT',
      'DELETE',
      'SUBMIT',
      'PULL_BACK',
      'RETURN_TO_DRAFT',
      'RELEASE',
    ] as const) {
      expect(confirmsOverride(action, [action])).toBe(true);
    }
  });

  it('lets an administrator claim their own version at once', () => {
    expect(confirmsOverride('CLAIM', ['CLAIM'])).toBe(false);
  });

  it('never asks for what the caller may do without the override', () => {
    expect(confirmsOverride('EDIT', [])).toBe(false);
    expect(confirmsOverride('SUBMIT', ['EDIT'])).toBe(false);
  });
});

describe('overriddenUser', () => {
  const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
  const ZORO = { id: 'u3', username: 'zoro', email: 'zoro@onepiece.local' };

  it('is the reviewer holding the version for a release, the author otherwise', () => {
    expect(overriddenUser('RELEASE', { author: NAMI, claimant: ZORO })).toBe('zoro');
    expect(overriddenUser('PULL_BACK', { author: NAMI, claimant: null })).toBe('nami');
    expect(overriddenUser('EDIT', { author: NAMI, claimant: null })).toBe('nami');
  });
});
