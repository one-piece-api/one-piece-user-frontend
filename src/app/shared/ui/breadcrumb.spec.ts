import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Breadcrumb, type Crumb } from './breadcrumb';

describe('Breadcrumb', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function render(crumbs: Crumb[]): HTMLElement {
    const fixture = TestBed.createComponent(Breadcrumb);
    fixture.componentRef.setInput('crumbs', crumbs);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows every step in order, as text only, separated, with the last one as the current page', () => {
    const root = render([
      { label: 'Contents' },
      { label: 'Devil Fruit Types', route: '/content/devil-fruit-types' },
      { label: 'Zoan' },
    ]);

    const steps = Array.from(root.querySelectorAll('nav > span')).map((step) =>
      step.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(steps).toEqual(['Contents ›', 'Devil Fruit Types ›', 'Zoan']);
    expect(root.querySelector('app-icon, img')).toBeNull();
    expect(root.querySelector('[aria-current="page"]')?.textContent).toContain('Zoan');
  });

  it('links a step that has a route, but never the last one', () => {
    const root = render([
      { label: 'Devil Fruit Types', route: '/content/devil-fruit-types' },
      { label: 'Zoan', route: '/content/devil-fruit-types/1' },
    ]);

    const links = Array.from(root.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/content/devil-fruit-types']);
  });
});
