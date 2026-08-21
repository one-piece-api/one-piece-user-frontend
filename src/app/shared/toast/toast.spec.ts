import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds toasts with auto-incrementing ids', () => {
    service.show('Ahoy!', 'success');
    service.show('Land ho!');

    expect(service.toasts()).toEqual([
      { id: 1, message: 'Ahoy!', tone: 'success' },
      { id: 2, message: 'Land ho!', tone: 'info' },
    ]);
  });

  it('dismisses a toast by id', () => {
    service.show('Ahoy!');
    const [toast] = service.toasts();

    service.dismiss(toast.id);

    expect(service.toasts()).toEqual([]);
  });

  it('auto-dismisses a toast after the timeout', () => {
    vi.useFakeTimers();

    service.show('Ahoy!');
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(5000);

    expect(service.toasts()).toHaveLength(0);
  });
});
