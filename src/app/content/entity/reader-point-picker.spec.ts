import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { DEVIL_FRUIT } from '../devil-fruits/devil-fruit.model';
import { draftOf } from './entity-body';
import { forwardTimeline, revealsOfDraft, type Belief } from './entity-reveals';
import { ReaderPointPicker } from './reader-point-picker';

const chapter = (number: number) => ({ id: `chapter-${number}`, number, names: {} });

/** The Gomu Gomu of the backend's fixture, cut to the description (T13). */
const FRUIT = {
  firstAppearance: { chapter: chapter(1) },
  translations: { en: { name: 'Human-Human Fruit', description: 'The fruit of the sun god' } },
  initialKnowledge: { translations: { en: { description: 'Rubber, nothing more' } } },
  reveals: [
    {
      revealedAt: { chapter: chapter(100) },
      fields: ['description'],
      titles: { en: 'A body of rubber' },
      translations: { en: { description: 'A body of rubber' } },
    },
    { revealedAt: { chapter: chapter(1044) }, fields: ['description'], titles: {} },
  ],
};

describe('how the reader sees it', () => {
  let fixture: ComponentFixture<ReaderPointPicker>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    const truth = draftOf(DEVIL_FRUIT, FRUIT as never, ['en']);
    fixture = TestBed.createComponent(ReaderPointPicker);
    fixture.componentRef.setInput(
      'nodes',
      forwardTimeline(
        DEVIL_FRUIT,
        truth as Belief,
        revealsOfDraft(truth),
        truth['firstAppearance'],
      ),
    );
    fixture.componentRef.setInput('point', 2);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  const text = () => root.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (label: string) =>
    root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const points = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="radio"]'));

  it('starts from the current truth, the last reveal', () => {
    expect(points().map((point) => point.getAttribute('aria-label'))).toEqual([
      'Ch. 1 — First appearance',
      'Ch. 100 — A body of rubber',
      'Ch. 1044 — Reveal at ch. 1044',
    ]);
    expect(text()).toContain('3/3');
    expect(root.querySelector('[data-testid="reader-truth"]')?.textContent?.trim()).toBe(
      'Current truth',
    );
    expect(button('Next reveal').disabled).toBe(true);
  });

  it('goes back one reveal at a time, saying the later ones are hidden', () => {
    button('Previous reveal').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.point()).toBe(1);
    expect(text()).toContain('Ch. 100 · A body of rubber');
    expect(root.querySelector('[data-testid="reader-hidden"]')?.textContent?.trim()).toBe(
      'Later reveals are hidden',
    );
  });

  it('jumps to the point picked, the first appearance included', () => {
    points()[0].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.point()).toBe(0);
    expect(points()[0].getAttribute('aria-checked')).toBe('true');
    expect(button('Previous reveal').disabled).toBe(true);
  });
});
