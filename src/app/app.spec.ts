import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/me')
      .flush({ username: 'luffy', email: 'luffy@onepiece.local', roles: ['ADMIN'] });

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the shell brand mark', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/me')
      .flush({ username: 'luffy', email: 'luffy@onepiece.local', roles: ['ADMIN'] });
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const logos = Array.from(compiled.querySelectorAll('img[alt="One Piece API"]'));
    expect(logos.length).toBeGreaterThan(0);
  });
});
