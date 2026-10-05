import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CloseButton } from './close-button';

@Component({
  imports: [CloseButton],
  template: `<app-close-button label="Close" (click)="clicks = clicks + 1" />`,
})
class Host {
  clicks = 0;
}

describe('CloseButton', () => {
  it('is a labelled native button with a drawn cross, whose click reaches the caller', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Close');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.textContent?.trim()).toBe('');

    button.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
