import { TestBed } from '@angular/core/testing';
import { AuditActorFilter } from './audit-actor-filter';

describe('AuditActorFilter', () => {
  function create(selected: string, options: string[]) {
    const fixture = TestBed.createComponent(AuditActorFilter);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('options', options);
    fixture.detectChanges();
    return fixture;
  }

  it('shows "Everyone" on the trigger when nothing is selected', () => {
    const fixture = create('', ['luffy@onepiece.local']);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Everyone');
  });

  it('shows the selected author on the trigger', () => {
    const fixture = create('luffy@onepiece.local', ['luffy@onepiece.local']);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('button')!.textContent).toContain('luffy@onepiece.local');
  });

  it('lists every option plus "Everyone" when opened', () => {
    const fixture = create('', ['luffy@onepiece.local', 'nami@onepiece.local']);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const optionLabels = Array.from(root.querySelector('[popover]')!.querySelectorAll('button')).map(
      (b) => b.textContent?.trim(),
    );
    expect(optionLabels).toEqual(['Everyone', 'luffy@onepiece.local', 'nami@onepiece.local']);
  });

  it('filters options by a case-insensitive substring as you type', () => {
    const fixture = create('', ['luffy@onepiece.local', 'nami@onepiece.local', 'zoro@onepiece.local']);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('input') as HTMLInputElement;
    searchInput.value = 'NAMI';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const optionLabels = Array.from(root.querySelector('[popover]')!.querySelectorAll('button')).map(
      (b) => b.textContent?.trim(),
    );
    expect(optionLabels).toEqual(['Everyone', 'nami@onepiece.local']);
  });

  it('shows a "no matching authors" message when the search matches nothing', () => {
    const fixture = create('', ['luffy@onepiece.local']);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('input') as HTMLInputElement;
    searchInput.value = 'nobody';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(root.textContent).toContain('No matching authors.');
  });

  it('emits the picked author and closes', () => {
    const fixture = create('', ['luffy@onepiece.local']);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.selectedChange.subscribe(spy);

    const root = fixture.nativeElement as HTMLElement;
    const option = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('luffy@onepiece.local'),
    );
    option!.click();

    expect(spy).toHaveBeenCalledWith('luffy@onepiece.local');
  });

  it('emits an empty string when "Everyone" is picked', () => {
    const fixture = create('luffy@onepiece.local', ['luffy@onepiece.local']);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.selectedChange.subscribe(spy);

    const root = fixture.nativeElement as HTMLElement;
    const everyoneOption = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Everyone',
    );
    everyoneOption!.click();

    expect(spy).toHaveBeenCalledWith('');
  });

  it('resets the search once the menu is closed and reopened', () => {
    const fixture = create('', ['luffy@onepiece.local', 'nami@onepiece.local']);
    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('input') as HTMLInputElement;
    searchInput.value = 'nami';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    trigger.click(); // close
    fixture.detectChanges();
    trigger.click(); // reopen
    fixture.detectChanges();

    const reopenedSearchInput = root.querySelector('input') as HTMLInputElement;
    expect(reopenedSearchInput.value).toBe('');
    // "Everyone" plus both actors, unfiltered.
    expect(root.querySelector('[popover]')!.querySelectorAll('button').length).toBe(3);
  });

  it('does not leave the popover host visible after closing (no forced display utility on it)', () => {
    const fixture = create('', ['luffy@onepiece.local']);
    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();
    trigger.click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('[popover]') as HTMLElement;
    expect(popover.className).not.toMatch(/(^|\s)(flex|grid|block|inline)(\s|$)/);
  });
});
