import { TestBed } from '@angular/core/testing';
import { LoadingPlaceholder } from './loading-placeholder';

describe('LoadingPlaceholder', () => {
  it('exposes the label to assistive tech via a live region, not as visible text', () => {
    const fixture = TestBed.createComponent(LoadingPlaceholder);
    fixture.componentRef.setInput('label', "Tracciamo l'equipaggio…");
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const status = root.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.getAttribute('aria-live')).toBe('polite');

    const label = status!.querySelector('.sr-only');
    expect(label!.textContent).toBe("Tracciamo l'equipaggio…");
  });

  it('renders the floating Sunny as decorative, not announced twice', () => {
    const fixture = TestBed.createComponent(LoadingPlaceholder);
    fixture.componentRef.setInput('label', 'Loading');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const ship = root.querySelector('img');
    expect(ship).not.toBeNull();
    expect(ship!.getAttribute('aria-hidden')).toBe('true');
    expect(ship!.getAttribute('alt')).toBe('');
  });
});
