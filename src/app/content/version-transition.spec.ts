import { HttpErrorResponse } from '@angular/common/http';
import { newVersionDoneKey, routeTargetOf, transitionRefusal } from './version-transition';

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

  it('names the version a submission repeats', () => {
    const error = refused(422, { errorCode: 'CONTENT_VERSION_IDENTICAL', identicalTo: 1 });

    expect(transitionRefusal(error)).toEqual({ kind: 'identical', version: 1 });
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

  it('offers nothing for an action the screens cannot run yet', () => {
    expect(routeTargetOf('RETIRE')).toBeUndefined();
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
