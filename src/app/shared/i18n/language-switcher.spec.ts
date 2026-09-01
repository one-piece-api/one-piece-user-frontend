import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
  });

  it('renders one button per available language, IT/EN', () => {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['it', 'en']);
  });

  it('marks the active language pressed, and only that one', () => {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const [itButton, enButton] = buttons;
    expect(enButton.getAttribute('aria-pressed')).toBe('true');
    expect(itButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches the active language and persists the choice when a button is clicked', () => {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();

    const itButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    itButton.click();
    fixture.detectChanges();

    expect(itButton.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('onepiece.lang')).toBe('it');
  });

  it('updates <html lang> to match the newly selected language', () => {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();

    const itButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    itButton.click();
    fixture.detectChanges();

    expect(document.documentElement.lang).toBe('it');
  });
});
