import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { MascotService } from './mascot';
import { MascotWidget } from './mascot-widget';

describe('MascotWidget', () => {
  async function createAt(url: string) {
    TestBed.configureTestingModule({
      imports: [MascotWidget, provideTranslocoTesting()],
      providers: [provideRouter([{ path: '**', component: MascotWidget }])],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(MascotWidget);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the always-present launcher, collapsed, by default', async () => {
    const fixture = await createAt('/');

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Open the Den Den Mushi"]')).not.toBeNull();
    expect(root.querySelector('[role="status"]')).toBeNull();
  });

  it('opens the idle greeting when the launcher is clicked', async () => {
    const fixture = await createAt('/');

    const launcher = fixture.nativeElement.querySelector(
      '[aria-label="Open the Den Den Mushi"]',
    ) as HTMLButtonElement;
    launcher.click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    expect(root.textContent).toContain('standing by');
  });

  it('minimizing closes the bubble back to the launcher', async () => {
    const fixture = await createAt('/');
    const mascotService = TestBed.inject(MascotService);
    mascotService.show('Ahoy!', 'success');
    fixture.detectChanges();

    const minimize = fixture.nativeElement.querySelector(
      '[aria-label="Minimize the Den Den Mushi"]',
    ) as HTMLButtonElement;
    minimize.click();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Open the Den Den Mushi"]')).not.toBeNull();
  });

  it('pipes up on its own with a contextual tip for a known route', async () => {
    vi.useFakeTimers();
    const fixture = await createAt('/users');
    const mascotService = TestBed.inject(MascotService);

    vi.advanceTimersByTime(24_000);
    fixture.detectChanges();

    expect(mascotService.open()).toBe(true);
    expect(mascotService.message().code).toBe('POST /users/:id/resend-invitation');
  });

  it('pipes up with a contextual tip on the roles & permissions page', async () => {
    vi.useFakeTimers();
    const fixture = await createAt('/roles');
    const mascotService = TestBed.inject(MascotService);

    vi.advanceTimersByTime(24_000);
    fixture.detectChanges();

    expect(mascotService.open()).toBe(true);
    expect(mascotService.message().code).toBe('roles:manage');
  });

  it('stays quiet on routes with no tip topic', async () => {
    vi.useFakeTimers();
    await createAt('/forbidden');
    const mascotService = TestBed.inject(MascotService);

    vi.advanceTimersByTime(24_000);

    expect(mascotService.open()).toBe(false);
  });

  it('stops ticking once destroyed', async () => {
    vi.useFakeTimers();
    const fixture = await createAt('/audit');
    const mascotService = TestBed.inject(MascotService);
    fixture.destroy();

    vi.advanceTimersByTime(24_000);

    expect(mascotService.open()).toBe(false);
  });
});
