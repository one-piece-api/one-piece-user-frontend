import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { AuditPagination } from './audit-pagination';

describe('AuditPagination', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
  });

  it('renders nothing when there is no range to show', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', null);
    fixture.componentRef.setInput('currentPage', 0);
    fixture.componentRef.setInput('totalPages', 0);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent?.trim()).toBe('');
  });

  it('shows only the range pill when there is a single page', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '1–1 of 1');
    fixture.componentRef.setInput('currentPage', 0);
    fixture.componentRef.setInput('totalPages', 1);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('1–1 of 1');
    expect(root.querySelectorAll('button').length).toBe(0);
  });

  it('shows the range pill in gold and the page label collapsed on mobile', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '1–1 of 3');
    fixture.componentRef.setInput('currentPage', 0);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const rangePill = Array.from(root.querySelectorAll('span')).find((s) =>
      s.textContent?.includes('1–1 of 3'),
    );
    expect(rangePill?.className).toContain('bg-treasure-500');
    expect(rangePill?.className).toContain('text-ocean-950');

    const pageLabel = Array.from(root.querySelectorAll('span')).find((s) =>
      s.textContent?.includes('Page 1 of 3'),
    );
    expect(pageLabel?.className).toContain('hidden');
    expect(pageLabel?.className).toContain('sm:inline-flex');

    expect(root.querySelector('.overflow-x-auto')).toBeTruthy();
  });

  it('gives mobile a compact prev/next pair instead of squeezing the numbered strip onto a narrow row', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '1–1 of 3');
    fixture.componentRef.setInput('currentPage', 0);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    // The numbered strip only ever appears inside the `sm`-and-up block.
    const desktopNav = root.querySelector('.overflow-x-auto')!.closest('.sm\\:flex')!;
    expect(desktopNav.className).toContain('hidden');
    expect(desktopNav.querySelectorAll('button').length).toBe(5); // ← 1 2 3 →

    // The mobile-only block has no numbered strip, just the two arrows.
    const mobileNav = Array.from(root.querySelectorAll('div')).find(
      (d) => d.className.includes('sm:hidden') && d.querySelectorAll('button').length > 0,
    )!;
    expect(mobileNav.className).not.toContain('overflow-x-auto');
    const mobileButtons = Array.from(mobileNav.querySelectorAll('button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(mobileButtons).toEqual(['←', '→']);
  });

  it('disables the previous arrow on the first page and the next arrow on the last', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '1–1 of 3');
    fixture.componentRef.setInput('currentPage', 0);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    let root = fixture.nativeElement as HTMLElement;
    let arrows = Array.from(root.querySelectorAll('button')).filter((b) =>
      ['←', '→'].includes(b.textContent?.trim() ?? ''),
    );
    expect(arrows.find((b) => b.textContent?.trim() === '←')?.disabled).toBe(true);
    expect(arrows.find((b) => b.textContent?.trim() === '→')?.disabled).toBe(false);

    fixture.componentRef.setInput('currentPage', 2);
    fixture.detectChanges();

    root = fixture.nativeElement as HTMLElement;
    arrows = Array.from(root.querySelectorAll('button')).filter((b) =>
      ['←', '→'].includes(b.textContent?.trim() ?? ''),
    );
    expect(arrows.find((b) => b.textContent?.trim() === '←')?.disabled).toBe(false);
    expect(arrows.find((b) => b.textContent?.trim() === '→')?.disabled).toBe(true);
  });

  it('emits previous, next and jumpTo', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '2–2 of 3');
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const previousSpy = vi.fn();
    const nextSpy = vi.fn();
    const jumpToSpy = vi.fn();
    fixture.componentInstance.previous.subscribe(previousSpy);
    fixture.componentInstance.next.subscribe(nextSpy);
    fixture.componentInstance.jumpTo.subscribe(jumpToSpy);

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.trim() === '←')!.click();
    buttons.find((b) => b.textContent?.trim() === '→')!.click();
    buttons.find((b) => b.textContent?.trim() === '3')!.click();

    expect(previousSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(jumpToSpy).toHaveBeenCalledWith(2);
  });

  it('shows every page with no ellipsis when there are 7 or fewer', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '1–1 of 4');
    fixture.componentRef.setInput('currentPage', 0);
    fixture.componentRef.setInput('totalPages', 4);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button'))
      .map((b) => b.textContent?.trim())
      .filter((t) => t !== '←' && t !== '→');
    expect(buttons).toEqual(['1', '2', '3', '4']);
    expect(root.textContent).not.toContain('…');
  });

  it('pins the first and last page around a sliding window with ellipses on both sides', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '16–20 of 100');
    fixture.componentRef.setInput('currentPage', 3);
    fixture.componentRef.setInput('totalPages', 10);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button'))
      .map((b) => b.textContent?.trim())
      .filter((t) => t !== '←' && t !== '→');
    expect(buttons).toEqual(['1', '3', '4', '5', '10']);
    expect(root.querySelectorAll('[aria-hidden="true"]').length).toBe(2);
  });

  it('slides the window so the current page stays visible as you page forward', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '31–35 of 100');
    fixture.componentRef.setInput('currentPage', 6);
    fixture.componentRef.setInput('totalPages', 20);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('7');
  });

  it('always keeps the first and last page reachable, even from the last page', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '96–100 of 100');
    fixture.componentRef.setInput('currentPage', 9);
    fixture.componentRef.setInput('totalPages', 10);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const jumpToSpy = vi.fn();
    fixture.componentInstance.jumpTo.subscribe(jumpToSpy);

    const buttons = Array.from(root.querySelectorAll('button'));
    const firstPageButton = buttons.find((b) => b.textContent?.trim() === '1');
    expect(firstPageButton).toBeTruthy();
    firstPageButton!.click();
    expect(jumpToSpy).toHaveBeenCalledWith(0);
  });

  it('highlights the current page among the numbered buttons', () => {
    const fixture = TestBed.createComponent(AuditPagination);
    fixture.componentRef.setInput('range', '2–2 of 3');
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const pageTwoButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '2',
    );
    const pageOneButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '1',
    );
    expect(pageTwoButton?.className).toContain('bg-treasure-500');
    expect(pageOneButton?.className).not.toContain('bg-treasure-500');
  });
});
