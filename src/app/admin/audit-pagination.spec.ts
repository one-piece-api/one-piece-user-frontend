import { TestBed } from '@angular/core/testing';
import { AuditPagination } from './audit-pagination';

describe('AuditPagination', () => {
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
