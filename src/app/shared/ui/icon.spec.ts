import { TestBed } from '@angular/core/testing';
import { Icon } from './icon';

describe('Icon', () => {
  function render(icon: string): HTMLElement {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('icon', icon);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a glyph as text', () => {
    const root = render('◈');

    expect(root.textContent?.trim()).toBe('◈');
    expect(root.querySelector('img')).toBeNull();
  });

  it('shows an image path as a decorative image', () => {
    const image = render('assets/devil-fruit-type.webp').querySelector('img');

    expect(image?.getAttribute('src')).toBe('assets/devil-fruit-type.webp');
    expect(image?.getAttribute('alt')).toBe('');
  });
});
