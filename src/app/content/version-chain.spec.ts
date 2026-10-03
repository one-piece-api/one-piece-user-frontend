import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import type { VersionStatus, VersionSummary } from './content.model';
import { VersionChain } from './version-chain';

const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };

function version(number: number, status: VersionStatus, everPublished: boolean): VersionSummary {
  return {
    number,
    status,
    author: NAMI,
    basedOn: number === 1 ? null : number - 1,
    claimant: null,
    everPublished,
    allowedActions: [],
    overrideActions: [],
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  };
}

/** v1 superseded, v2 online, v3 archived without ever going online, v4 a draft. */
const CHAIN = [
  version(1, 'SUPERSEDED', true),
  version(2, 'PUBLISHED', true),
  version(3, 'ARCHIVED', false),
  version(4, 'DRAFT', false),
];

describe('VersionChain', () => {
  let fixture: ComponentFixture<VersionChain>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
  });

  function render(selectedNumber: number): void {
    fixture = TestBed.createComponent(VersionChain);
    fixture.componentRef.setInput('versions', CHAIN);
    fixture.componentRef.setInput('selectedNumber', selectedNumber);
    fixture.componentRef.setInput('onlineVersionNumber', 2);
    fixture.detectChanges();
  }

  function circles(): HTMLButtonElement[] {
    const root = fixture.nativeElement as HTMLElement;
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testid="version-link"]'));
  }

  function captions(): string[] {
    const root = fixture.nativeElement as HTMLElement;
    return Array.from(root.querySelectorAll('li')).map(
      (link) => link.querySelector('div > span')?.textContent?.trim() ?? '',
    );
  }

  it('shows one circle per version, the most recent first', () => {
    render(4);

    expect(circles().map((circle) => circle.textContent?.trim().slice(0, 2))).toEqual([
      'v4',
      'v3',
      'v2',
      'v1',
    ]);
  });

  it('dashes the border of the versions that were never online', () => {
    render(4);

    const dashed = circles().map((circle) => circle.classList.contains('border-dashed'));
    expect(dashed).toEqual([true, true, false, false]);
  });

  it('puts the anchor on the online version only', () => {
    render(4);

    const anchored = circles().map(
      (circle) => circle.querySelector('[data-testid="online-anchor"]') !== null,
    );
    expect(anchored).toEqual([false, false, true, false]);
  });

  it('captions each version with its status, "online" for the online one, nothing for a superseded one', () => {
    render(4);

    expect(captions()).toEqual(['Draft', 'Archived', 'online', '']);
  });

  it('fills the selected version with the color of its status', () => {
    render(3);

    const [draft, archived] = circles();
    expect(archived.getAttribute('aria-pressed')).toBe('true');
    expect(archived.className).toContain('bg-status-archived-accent');
    expect(draft.getAttribute('aria-pressed')).toBe('false');
    expect(draft.className).not.toContain('bg-status-draft-accent');
  });

  it('gives the selected version, and only it, a pulsing halo of the color of its status', () => {
    render(3);

    const pulsing = circles().filter((circle) => circle.classList.contains('anim-selected-pulse'));
    expect(pulsing.map((circle) => circle.getAttribute('aria-pressed'))).toEqual(['true']);
    expect(pulsing[0].className).toContain('shadow-status-archived-accent');
  });

  it('fades and shrinks the versions that are not selected', () => {
    render(3);

    const steppedBack = circles().map(
      (circle) => circle.classList.contains('opacity-60') && circle.classList.contains('scale-90'),
    );
    expect(steppedBack).toEqual([true, false, true, true]);
  });

  it('says in the tooltip when a version was never published', () => {
    render(4);

    expect(circles()[0].title).toContain('v4 · Draft');
    expect(circles()[0].title).toContain('never published');
    expect(circles()[2].title).not.toContain('never published');
  });

  it('emits the number of the version that is picked', () => {
    render(4);
    const picked: number[] = [];
    fixture.componentInstance.picked.subscribe((number) => picked.push(number));

    circles()[3].click();

    expect(picked).toEqual([1]);
  });
});
