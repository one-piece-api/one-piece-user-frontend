import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import type { Version, VersionAction, VersionEvent, VersionStatus } from './content.model';
import { VersionWorkflow } from './version-workflow';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const ZORO = { id: 'u3', username: 'zoro', email: 'zoro@onepiece.local' };
const VIVI = { id: 'u4', username: 'vivi', email: 'vivi@onepiece.local' };

const EDITOR = ['content:read', 'content:write'];
const REVIEWER = ['content:read', 'content:review'];

/** Local-time instants: the labels follow the viewer's own calendar. */
function at(day: number, hour: number): string {
  return new Date(2026, 7, day, hour, 0).toISOString();
}

function event(action: string, actor = NAMI, hour = 8, detail: string | null = null): VersionEvent {
  return { action, actor, detail, occurredAt: at(20, hour) };
}

function version(
  status: VersionStatus,
  allowedActions: VersionAction[] = [],
  overrides: Partial<Version<unknown>> = {},
): Version<unknown> {
  return {
    number: 2,
    status,
    author: NAMI,
    basedOn: 1,
    claimant: null,
    everPublished: false,
    createdAt: at(20, 8),
    updatedAt: at(20, 8),
    rejectionReason: null,
    body: null,
    allowedActions,
    ...overrides,
  };
}

/** Submitted and waiting; then the same version once zoro has claimed it. */
const WAITING = [event('VERSION_CREATED'), event('VERSION_SUBMITTED', NAMI, 9)];
const HELD = version('IN_REVIEW', [], { claimant: ZORO });

describe('VersionWorkflow', () => {
  let fixture: ComponentFixture<VersionWorkflow>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  /** Renders the tab for `shown` and its history, as `username` holding `permissions`. */
  async function render(
    shown: Version<unknown>,
    events: VersionEvent[],
    username: string,
    permissions: string[],
  ): Promise<void> {
    fixture = TestBed.createComponent(VersionWorkflow);
    fixture.componentRef.setInput('version', shown);
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/me')
      .flush({ username, email: `${username}@onepiece.local`, roles: [], permissions });
    await fixture.whenStable();
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function mapNode(status: VersionStatus): HTMLElement {
    return root.querySelector<HTMLElement>(`[data-testid="route-node"][data-status="${status}"]`)!;
  }

  /** What an element says, piece by piece: its texts, each trimmed, joined by one space. */
  function wordsOf(element: Element | null | undefined): string {
    const texts: string[] = [];
    const walker = document.createTreeWalker(element ?? root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      texts.push(walker.currentNode.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    }
    return texts.filter(Boolean).join(' ');
  }

  /** The labels and the notes of the column holding that status. */
  function mapText(status: VersionStatus): string {
    return wordsOf(mapNode(status).closest('li'));
  }

  function steps(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="timeline-step"]')).map(wordsOf);
  }

  function access(kind: 'visible' | 'editable' | 'workflow'): string {
    return wordsOf(root.querySelector(`[data-testid="access-${kind}"]`));
  }

  describe('the editorial route', () => {
    it('marks the current status with the ship and the ones gone through with a check', async () => {
      const events = [
        event('VERSION_CREATED', NAMI, 8),
        event('VERSION_SUBMITTED', NAMI, 9),
        event('VERSION_CLAIMED', ZORO, 10),
        event('VERSION_APPROVED', ZORO, 11),
      ];
      await render(version('READY_TO_PUBLISH'), events, 'vivi', ['content:read']);

      expect(root.querySelectorAll('[data-testid="route-node"]').length).toBe(8);
      expect(root.querySelectorAll('[data-testid="route-ship"]').length).toBe(1);
      expect(mapNode('READY_TO_PUBLISH').getAttribute('aria-current')).toBe('step');
      expect(mapNode('DRAFT').dataset['state']).toBe('visited');
      expect(mapNode('DRAFT').textContent?.trim()).toBe('✓');
      expect(mapNode('PUBLISHED').dataset['state']).toBe('idle');
      expect(mapNode('REJECTED').dataset['state']).toBe('idle');
      // Under the current status, who approved it; under a past one, when it was reached.
      expect(mapText('READY_TO_PUBLISH')).toContain('by zoro');
      expect(mapText('IN_REVIEW')).toContain('08/20 09:00 AM');
    });

    it('says since when a version waits in review unclaimed', async () => {
      await render(version('IN_REVIEW'), WAITING, 'zoro', REVIEWER);

      expect(mapText('IN_REVIEW')).toContain('queued · 08/20 09:00 AM');
    });

    it('tells the reviewer holding a version in review that it is theirs', async () => {
      await render(HELD, [...WAITING, event('VERSION_CLAIMED', ZORO, 10)], 'zoro', REVIEWER);

      expect(mapText('IN_REVIEW')).toContain('claimed by you');
    });

    it('tells everyone else who holds a version in review', async () => {
      await render(HELD, [...WAITING, event('VERSION_CLAIMED', ZORO, 10)], 'nami', EDITOR);

      expect(mapText('IN_REVIEW')).toContain('claimed by zoro');
    });

    it('keeps the ship on a branch when the version is there', async () => {
      const events = [
        event('VERSION_CREATED'),
        event('VERSION_SUBMITTED', NAMI, 9),
        event('VERSION_REJECTED', ZORO, 11, 'Too short'),
      ];
      await render(version('REJECTED'), events, 'nami', EDITOR);

      expect(mapNode('REJECTED').getAttribute('aria-current')).toBe('step');
      expect(mapText('REJECTED')).toContain('by zoro · 08/20 11:00 AM');
      expect(mapNode('IN_REVIEW').dataset['state']).toBe('visited');
    });

    it('explains every status in a legend that opens on request', async () => {
      await render(version('DRAFT'), [event('VERSION_CREATED')], 'nami', EDITOR);
      expect(root.querySelector('[data-testid="status-legend"]')).toBeNull();

      const toggle = root.querySelector<HTMLButtonElement>('[data-testid="legend-toggle"]')!;
      expect(toggle.textContent).toContain('What each status means');
      toggle.click();
      fixture.detectChanges();

      const legend = root.querySelector('[data-testid="status-legend"]');
      expect(legend?.querySelectorAll('li').length).toBe(8);
      expect(legend?.textContent).toContain('READY_TO_PUBLISH');
      expect(legend?.textContent).toContain('It was online, then another version took its place.');
      expect(toggle.textContent).toContain('Hide the legend');
    });
  });

  describe('the timeline', () => {
    it('lists who did what and when, the most recent first, claims included', async () => {
      const events = [
        event('VERSION_CREATED', NAMI, 8),
        event('VERSION_SUBMITTED', NAMI, 9),
        event('VERSION_CLAIMED', ZORO, 10),
        event('VERSION_APPROVED', ZORO, 11),
        event('VERSION_PUBLISHED', VIVI, 12),
      ];
      await render(version('PUBLISHED'), events, 'nami', EDITOR);

      expect(steps()).toEqual([
        '⚓ Published vivi 08/20 12:00 PM',
        '✓ Approved zoro 08/20 11:00 AM',
        '✋ Claimed zoro 08/20 10:00 AM',
        '↗ Submitted for review You 08/20 09:00 AM',
        '✎ New draft from v1 You 08/20 08:00 AM',
      ]);
    });

    it('shows the reason of a rejection', async () => {
      const events = [
        event('VERSION_CREATED'),
        event('VERSION_REJECTED', ZORO, 11, 'The Italian name is off the glossary'),
      ];
      await render(version('REJECTED', [], { basedOn: null }), events, 'nami', EDITOR);

      const reasons = root.querySelectorAll('[data-testid="timeline-reason"]');
      expect(reasons.length).toBe(1);
      expect(reasons[0].textContent).toContain('Reason:');
      expect(reasons[0].textContent).toContain('The Italian name is off the glossary');
      expect(steps()[1]).toContain('Draft created');
    });

    it('names the version that took the place of a superseded one', async () => {
      const events = [
        event('VERSION_PUBLISHED', VIVI, 10),
        event('VERSION_SUPERSEDED', VIVI, 12, '3'),
      ];
      await render(version('SUPERSEDED', [], { everPublished: true }), events, 'nami', EDITOR);

      expect(steps()[0]).toBe('⇡ Superseded by v3 vivi 08/20 12:00 PM');
      expect(mapText('SUPERSEDED')).toContain('by v3');
    });

    it('lists an action it has no name for as it was recorded', async () => {
      await render(version('DRAFT'), [event('VERSION_TELEPORTED')], 'nami', EDITOR);

      expect(steps()).toEqual(['• VERSION_TELEPORTED You 08/20 08:00 AM']);
    });

    it('says so when nothing was recorded', async () => {
      await render(version('PUBLISHED'), [], 'nami', EDITOR);

      expect(steps()).toEqual([]);
      expect(root.textContent).toContain('No event recorded for this version.');
    });
  });

  describe('the permissions panel', () => {
    it('tells the author of a draft what they may do with it', async () => {
      const draft = version('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']);
      await render(draft, [event('VERSION_CREATED')], 'nami', EDITOR);

      expect(access('visible')).toBe('✓ Visible to editors only');
      expect(access('editable')).toBe('✓ Editable it is your draft');
      expect(access('workflow')).toBe('→ Workflow: discard draft · submit for review');
    });

    it('tells another editor the draft is not theirs', async () => {
      await render(version('DRAFT'), [event('VERSION_CREATED')], 'chopper', EDITOR);

      expect(access('editable')).toBe('✕ Not editable it belongs to nami');
      expect(access('workflow')).toBe('✕ No workflow action only its author can move it forward');
    });

    it('tells a reviewer they may claim, but not edit', async () => {
      await render(version('IN_REVIEW', ['CLAIM']), [], 'zoro', REVIEWER);

      expect(access('visible')).toBe('✓ Visible to editors and reviewers');
      expect(access('editable')).toBe('✕ Not editable you lack content:write');
      expect(access('workflow')).toBe('→ Workflow: claim click In review to claim it');
    });

    it('names the version a new draft would start from', async () => {
      const online = version('PUBLISHED', ['OPEN_NEW_VERSION'], { everPublished: true });
      await render(online, [], 'nami', EDITOR);

      expect(access('visible')).toBe('✓ Visible to the whole editorial crew');
      expect(access('workflow')).toBe('→ Workflow: new draft from v2');
    });
  });

  describe('editing from the route', () => {
    it('turns the Draft status of a draft the caller may edit into the way to edit it', async () => {
      await render(
        version('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']),
        [event('VERSION_CREATED')],
        'nami',
        EDITOR,
      );
      const asked: VersionAction[] = [];
      fixture.componentInstance.act.subscribe((action) => asked.push(action));

      const node = mapNode('DRAFT');
      expect(node.tagName).toBe('BUTTON');
      expect(node.textContent?.trim()).toBe('✎');
      expect(node.className).toContain('anim-node-pulse');
      expect(mapText('DRAFT')).toContain('click to edit');
      node.click();

      expect(asked).toEqual(['EDIT']);
    });

    it('leaves the Draft status of someone else’s draft as a plain status', async () => {
      await render(version('DRAFT'), [event('VERSION_CREATED')], 'chopper', EDITOR);

      expect(mapNode('DRAFT').tagName).toBe('SPAN');
      expect(mapText('DRAFT')).not.toContain('click to edit');
      expect(root.querySelectorAll('button[data-testid="route-node"]').length).toBe(0);
    });
  });

  describe('moving the version along the route', () => {
    function asked(): VersionAction[] {
      const actions: VersionAction[] = [];
      fixture.componentInstance.act.subscribe((action) => actions.push(action));
      return actions;
    }

    it('offers the author of a draft to submit it, on the In review status', async () => {
      await render(
        version('DRAFT', ['EDIT', 'DELETE', 'SUBMIT']),
        [event('VERSION_CREATED')],
        'nami',
        EDITOR,
      );
      const actions = asked();

      const node = mapNode('IN_REVIEW');
      expect(node.tagName).toBe('BUTTON');
      expect(node.dataset['state']).toBe('next');
      expect(node.className).toContain('border-dashed');
      expect(node.className).toContain('anim-node-pulse');
      expect(node.title).toBe('Click to: Submit for review · Submitted for review.');
      expect(mapText('IN_REVIEW')).toContain('→ Submit for review');
      node.click();

      expect(actions).toEqual(['SUBMIT']);
    });

    it('offers the author of an unclaimed version in review to pull it back, on Draft', async () => {
      await render(version('IN_REVIEW', ['PULL_BACK']), WAITING, 'nami', EDITOR);
      const actions = asked();

      // Already gone through, Draft is the way back now rather than a check.
      const node = mapNode('DRAFT');
      expect(node.dataset['state']).toBe('next');
      expect(mapText('DRAFT')).toContain('→ Pull back from review');
      node.click();

      expect(actions).toEqual(['PULL_BACK']);
    });

    it('offers nothing to whoever may not move the version', async () => {
      await render(version('IN_REVIEW'), WAITING, 'chopper', EDITOR);

      expect(mapNode('DRAFT').dataset['state']).toBe('visited');
      expect(root.querySelectorAll('button[data-testid="route-node"]').length).toBe(0);
    });

    it('never offers a transition the screens cannot run yet', async () => {
      const approved = version('READY_TO_PUBLISH', ['ARCHIVE']);
      await render(approved, WAITING, 'vivi', ['content:read', 'content:publish']);

      expect(root.querySelectorAll('[data-state="next"]').length).toBe(0);
    });

    it('offers a publisher to publish a version ready to publish, on Published', async () => {
      const approved = version('READY_TO_PUBLISH', ['PUBLISH', 'ARCHIVE']);
      await render(approved, WAITING, 'vivi', ['content:read', 'content:publish']);
      const actions = asked();

      const node = mapNode('PUBLISHED');
      expect(node.dataset['state']).toBe('next');
      expect(mapText('PUBLISHED')).toContain('→ Publish');
      node.click();

      expect(actions).toEqual(['PUBLISH']);
    });

    it('waits while a transition is on its way', async () => {
      await render(version('IN_REVIEW', ['PULL_BACK']), WAITING, 'nami', EDITOR);
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();

      expect((mapNode('DRAFT') as HTMLButtonElement).disabled).toBe(true);
    });

    it('offers a reviewer to claim an unclaimed version on its In review status', async () => {
      await render(version('IN_REVIEW', ['CLAIM']), WAITING, 'zoro', REVIEWER);
      const actions = asked();

      const node = mapNode('IN_REVIEW');
      expect(node.tagName).toBe('BUTTON');
      expect(node.dataset['state']).toBe('current');
      expect(node.textContent?.trim()).toBe('✋');
      expect(node.className).toContain('anim-node-pulse');
      expect(node.title).toBe('Click to claim the review');
      expect(mapText('IN_REVIEW')).toContain('✋ claim it');
      node.click();

      expect(actions).toEqual(['CLAIM']);
    });

    it('offers the reviewer holding a version to release it, without pulsing', async () => {
      const held = version('IN_REVIEW', ['RELEASE', 'APPROVE', 'REJECT'], { claimant: ZORO });
      await render(held, [...WAITING, event('VERSION_CLAIMED', ZORO, 10)], 'zoro', REVIEWER);
      const actions = asked();

      const node = mapNode('IN_REVIEW');
      expect(node.tagName).toBe('BUTTON');
      expect(node.textContent?.trim()).toBe('✋');
      expect(node.className).not.toContain('anim-node-pulse');
      expect(mapText('IN_REVIEW')).toContain('claimed by you · ↩ click to release');
      node.click();

      expect(actions).toEqual(['RELEASE']);
    });

    it('leaves a version someone else holds as a plain status naming them', async () => {
      await render(HELD, [...WAITING, event('VERSION_CLAIMED', ZORO, 10)], 'law', REVIEWER);

      expect(mapNode('IN_REVIEW').tagName).toBe('SPAN');
      expect(mapText('IN_REVIEW')).toContain('claimed by zoro');
      expect(access('workflow')).toBe('✕ No workflow action claimed by zoro');
    });

    it('explains the gold nodes in the inline legend', async () => {
      await render(version('DRAFT'), [event('VERSION_CREATED')], 'nami', EDITOR);

      expect(root.textContent).toContain('transition available to you · click the node');
    });
  });
});
