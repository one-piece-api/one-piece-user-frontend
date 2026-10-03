import type { VersionAction, VersionStatus } from './content.model';
import { versionAccess, type AccessCaller, type AccessRow } from './version-access';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const ZORO = { id: 'u3', username: 'zoro', email: 'zoro@onepiece.local' };

const READ = 'content:read';
const editor = (username: string): AccessCaller => ({
  username,
  permissions: [READ, 'content:write'],
});
const reviewer = (username: string): AccessCaller => ({
  username,
  permissions: [READ, 'content:review'],
});
const PUBLISHER: AccessCaller = { username: 'vivi', permissions: [READ, 'content:publish'] };

/** A version by nami in `status`, with what the backend allows the caller. */
function version(status: VersionStatus, allowedActions: VersionAction[] = [], claimant = false) {
  return { status, author: NAMI, claimant: claimant ? ZORO : null, allowedActions };
}

/** The three lines by kind, each reduced to what it grants and the reason it gives. */
function lines(rows: AccessRow[]) {
  const [visible, editable, workflow] = rows.map((row) => ({
    granted: row.granted,
    note: row.noteKey?.replace('content.workflow.access.', '') ?? null,
    params: row.noteParams,
    actions: row.actions,
  }));
  return { visible, editable, workflow };
}

describe('versionAccess', () => {
  it('always grants seeing, and says who else sees a version in that status', () => {
    const noteFor = (status: VersionStatus) =>
      lines(versionAccess(version(status), PUBLISHER)).visible.note;

    expect(noteFor('DRAFT')).toBe('visibleToEditors');
    expect(noteFor('REJECTED')).toBe('visibleToEditors');
    expect(noteFor('IN_REVIEW')).toBe('visibleToReviewers');
    expect(noteFor('READY_TO_PUBLISH')).toBe('visibleToAll');
    expect(noteFor('PUBLISHED')).toBe('visibleToAll');
  });

  it('gives the author of a draft the editing and the actions the backend allows', () => {
    const draft = version('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);

    const { editable, workflow } = lines(versionAccess(draft, editor('nami')));

    expect(editable).toMatchObject({ granted: true, note: 'ownDraft' });
    // Editing has its own line: the workflow line lists everything else.
    expect(workflow).toMatchObject({ granted: true, note: null, actions: ['DELETE', 'SUBMIT'] });
  });

  it('tells another editor whose the draft is, and that only its author moves it', () => {
    const { editable, workflow } = lines(versionAccess(version('DRAFT'), editor('chopper')));

    expect(editable).toMatchObject({
      granted: false,
      note: 'belongsTo',
      params: { author: 'nami' },
    });
    expect(workflow).toMatchObject({ granted: false, note: 'authorOnly', actions: [] });
  });

  it('tells the author of a rejected version to return it to draft before editing', () => {
    const rejected = version('REJECTED', ['RETURN_TO_DRAFT']);

    const { editable, workflow } = lines(versionAccess(rejected, editor('nami')));

    expect(editable).toMatchObject({ granted: false, note: 'returnFirst' });
    expect(workflow).toMatchObject({ granted: true, actions: ['RETURN_TO_DRAFT'] });
  });

  it('tells who cannot write which permission is missing', () => {
    const { editable } = lines(versionAccess(version('IN_REVIEW', ['CLAIM']), reviewer('zoro')));

    expect(editable).toMatchObject({ granted: false, note: 'missingWrite' });
  });

  it('tells an editor that only a draft can be edited', () => {
    const { editable } = lines(versionAccess(version('PUBLISHED'), editor('nami')));

    expect(editable).toMatchObject({ granted: false, note: 'onlyDraft' });
  });

  it('offers a reviewer the claim on a version waiting in review, and says where to click', () => {
    const { workflow } = lines(versionAccess(version('IN_REVIEW', ['CLAIM']), reviewer('zoro')));

    expect(workflow).toMatchObject({ granted: true, note: 'claimHere', actions: ['CLAIM'] });
  });

  it('adds nothing to the actions of the reviewer holding a version', () => {
    const held = version('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT'], true);
    const { workflow } = lines(versionAccess(held, reviewer('zoro')));

    expect(workflow).toMatchObject({ granted: true, note: null });
  });

  it('says who holds a version in review to whoever can do nothing about it', () => {
    const held = version('IN_REVIEW', [], true);

    const forAuthor = lines(versionAccess(held, editor('nami'))).workflow;
    const forOtherReviewer = lines(versionAccess(held, reviewer('law'))).workflow;

    expect(forAuthor).toMatchObject({
      granted: false,
      note: 'claimedBy',
      params: { reviewer: 'zoro' },
    });
    expect(forOtherReviewer).toMatchObject({ granted: false, note: 'claimedBy' });
  });

  it('tells a reviewer they do not review their own content', () => {
    const law: AccessCaller = { username: 'nami', permissions: [READ, 'content:review'] };

    const { workflow } = lines(versionAccess(version('IN_REVIEW'), law));

    expect(workflow).toMatchObject({ granted: false, note: 'ownReview' });
  });

  it('tells who cannot review or publish which permission the next step takes', () => {
    const inReview = lines(versionAccess(version('IN_REVIEW'), editor('chopper'))).workflow;
    const ready = lines(versionAccess(version('READY_TO_PUBLISH'), editor('nami'))).workflow;

    expect(inReview).toMatchObject({ granted: false, note: 'needsReview' });
    expect(ready).toMatchObject({ granted: false, note: 'needsPublish' });
  });

  it('tells a writer that a closed version cannot start a draft while another one is open', () => {
    const { workflow } = lines(versionAccess(version('PUBLISHED'), editor('nami')));

    expect(workflow).toMatchObject({ granted: false, note: 'openVersionExists' });
  });

  it('gives a publisher the actions on a ready version, and none on a closed one', () => {
    const ready = version('READY_TO_PUBLISH', ['PUBLISH', 'ARCHIVE']);

    expect(lines(versionAccess(ready, PUBLISHER)).workflow).toMatchObject({
      granted: true,
      actions: ['PUBLISH', 'ARCHIVE'],
    });
    expect(lines(versionAccess(version('ARCHIVED'), reviewer('zoro'))).workflow).toMatchObject({
      granted: false,
      note: 'noTransition',
    });
  });
});
