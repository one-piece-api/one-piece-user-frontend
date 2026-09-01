import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
  });

  it('starts on the testing catalog default language, reflected on <html lang>', () => {
    const service = TestBed.inject(LanguageService);
    TestBed.tick();

    expect(service.active()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches the active language and updates <html lang>', () => {
    const service = TestBed.inject(LanguageService);
    TestBed.tick();

    service.setLanguage('it');
    TestBed.tick();

    expect(service.active()).toBe('it');
    expect(document.documentElement.lang).toBe('it');
  });

  it('persists the chosen language for the next visit', () => {
    const service = TestBed.inject(LanguageService);

    service.setLanguage('it');

    expect(localStorage.getItem('onepiece.lang')).toBe('it');
  });
});
