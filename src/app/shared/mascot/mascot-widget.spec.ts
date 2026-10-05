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

  it('lives in the top layer and comes back on top of it with every message', async () => {
    const calls: string[] = [];
    // jsdom has no popover API: record what a browser would be asked to do.
    HTMLElement.prototype.showPopover = function () {
      calls.push('show');
    };
    HTMLElement.prototype.hidePopover = function () {
      calls.push('hide');
    };
    try {
      const fixture = await createAt('/');
      const layer = (fixture.nativeElement as HTMLElement).querySelector('[popover]');
      expect(layer?.getAttribute('popover')).toBe('manual');
      calls.length = 0;

      TestBed.inject(MascotService).show('Ahoy!', 'success');
      fixture.detectChanges();

      expect(calls).toEqual(['hide', 'show']);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
      Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
    }
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

  it('pipes up with a contextual tip on "Lingue"', async () => {
    vi.useFakeTimers();
    const fixture = await createAt('/languages');
    const mascotService = TestBed.inject(MascotService);

    vi.advanceTimersByTime(24_000);
    fixture.detectChanges();

    expect(mascotService.open()).toBe(true);
    expect(mascotService.message().code).toBe('languages:manage');
  });

  it('pipes up with a contextual tip on the dashboard and its status pages', async () => {
    vi.useFakeTimers();
    const fixture = await createAt('/dashboard/in-review');
    const mascotService = TestBed.inject(MascotService);

    vi.advanceTimersByTime(24_000);
    fixture.detectChanges();

    expect(mascotService.open()).toBe(true);
    expect(mascotService.message().code).toBe('dashboard · status pages');
  });

  it('pipes up with a contextual tip in a content section', async () => {
    vi.useFakeTimers();
    const fixture = await createAt('/content/devil-fruit-types');
    const mascotService = TestBed.inject(MascotService);

    vi.advanceTimersByTime(24_000);
    fixture.detectChanges();

    expect(mascotService.open()).toBe(true);
    expect(mascotService.message().code).toBe('content:review → content:publish');
  });

  it('keeps an error on screen when the next tip is due', async () => {
    vi.useFakeTimers();
    const fixture = await createAt('/users');
    const mascotService = TestBed.inject(MascotService);
    mascotService.show('Could not save', 'error');

    vi.advanceTimersByTime(24_000);
    fixture.detectChanges();

    expect(mascotService.message().text).toBe('Could not save');
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
