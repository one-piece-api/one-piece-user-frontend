import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { SortHeader, type SortDirection } from './sort-header';

describe('SortHeader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
    }).compileComponents();
  });

  function render(direction: SortDirection | null) {
    const fixture = TestBed.createComponent(SortHeader);
    fixture.componentRef.setInput('label', 'Name');
    fixture.componentRef.setInput('direction', direction);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      button: root.querySelector('button') as HTMLButtonElement,
      arrow: root.querySelector('button span') as HTMLElement,
    };
  }

  it('only hints at the arrow on a column the list is not sorted by', () => {
    const { button, arrow } = render(null);

    expect(button.textContent).toContain('Name');
    expect(arrow.className).toContain('opacity-0');
    expect(arrow.className).toContain('group-hover:opacity-50');
    expect(button.getAttribute('aria-label')).toBe('Sort: Name');
  });

  it('shows the direction of the column the list is sorted by', () => {
    const ascending = render('asc');
    expect(ascending.arrow.textContent).toBe('↑');
    expect(ascending.arrow.className).toContain('opacity-100');
    expect(ascending.button.getAttribute('aria-label')).toBe('Name: ascending');

    const descending = render('desc');
    expect(descending.arrow.textContent).toBe('↓');
    expect(descending.button.title).toBe('Name: descending');
  });

  it('tells the page it was clicked', () => {
    const { fixture, button } = render(null);
    let toggled = 0;
    fixture.componentInstance.toggled.subscribe(() => toggled++);

    button.click();

    expect(toggled).toBe(1);
  });
});
