import type { Version, VersionAction } from './content.model';

/** Who is looking: the username tells their own versions apart, the permissions explain a refusal. */
export interface AccessCaller {
  readonly username: string | undefined;
  readonly permissions: readonly string[];
}

/**
 * One line of "your permissions here": seeing, editing and moving a version forward are
 * three separate things. `granted` comes from what the backend allows; the note only
 * explains it, in words.
 */
export interface AccessRow {
  readonly kind: 'visible' | 'editable' | 'workflow';
  readonly granted: boolean;
  /** The workflow actions the caller may perform - empty on the other two lines. */
  readonly actions: readonly VersionAction[];
  readonly noteKey: string | null;
  readonly noteParams: Record<string, string>;
}

type AccessVersion = Pick<Version<unknown>, 'status' | 'author' | 'claimant' | 'allowedActions'>;

type Note = Pick<AccessRow, 'noteKey' | 'noteParams'>;

const NO_NOTE: Note = { noteKey: null, noteParams: {} };

function note(key: string, noteParams: Record<string, string> = {}): Note {
  return { noteKey: `content.workflow.access.${key}`, noteParams };
}

/**
 * The three lines for one version and one caller. What is allowed is read from
 * `allowedActions` and never worked out here; what this adds is the reason, from plain
 * facts - the status, who wrote the version, who holds it, which permission is missing.
 */
export function versionAccess(version: AccessVersion, caller: AccessCaller): AccessRow[] {
  const editable = version.allowedActions.includes('EDIT');
  const actions = version.allowedActions.filter((action) => action !== 'EDIT');
  return [
    { kind: 'visible', granted: true, actions: [], ...visibleNote(version) },
    { kind: 'editable', granted: editable, actions: [], ...editableNote(version, caller) },
    {
      kind: 'workflow',
      granted: actions.length > 0,
      actions,
      ...(actions.length > 0 ? NO_NOTE : idleNote(version, caller)),
    },
  ];
}

/** Who else sees a version in this status. */
function visibleNote(version: AccessVersion): Note {
  switch (version.status) {
    case 'DRAFT':
    case 'REJECTED':
      return note('visibleToEditors');
    case 'IN_REVIEW':
      return note('visibleToReviewers');
    default:
      return note('visibleToAll');
  }
}

function editableNote(version: AccessVersion, caller: AccessCaller): Note {
  const mine = version.author.username === caller.username;
  if (version.allowedActions.includes('EDIT')) {
    return mine ? note('ownDraft') : NO_NOTE;
  }
  if (!caller.permissions.includes('content:write')) {
    return note('missingWrite');
  }
  if (version.status === 'REJECTED' && mine) {
    return note('returnFirst');
  }
  if (version.status === 'DRAFT' || version.status === 'REJECTED') {
    return note('belongsTo', { author: version.author.username });
  }
  return note('onlyDraft');
}

/** Why the caller can move nothing forward. */
function idleNote(version: AccessVersion, caller: AccessCaller): Note {
  switch (version.status) {
    case 'DRAFT':
    case 'REJECTED':
      return note('authorOnly');
    case 'IN_REVIEW':
      return reviewNote(version, caller);
    case 'READY_TO_PUBLISH':
      return note('needsPublish');
    default:
      // A closed version: a writer could open a new draft from it, were there not one already.
      return caller.permissions.includes('content:write')
        ? note('openVersionExists')
        : note('noTransition');
  }
}

function reviewNote(version: AccessVersion, caller: AccessCaller): Note {
  if (version.claimant) {
    return note('claimedBy', { reviewer: version.claimant.username });
  }
  if (!caller.permissions.includes('content:review')) {
    return note('needsReview');
  }
  return version.author.username === caller.username ? note('ownReview') : NO_NOTE;
}
