import { TestBed } from '@angular/core/testing';
import { MascotService } from './mascot';

describe('MascotService', () => {
  let service: MascotService;

  beforeEach(() => {
    service = TestBed.inject(MascotService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts closed with an idle greeting loaded', () => {
    expect(service.open()).toBe(false);
    expect(service.message().tone).toBe('info');
  });

  it('shows a message and opens the bubble', () => {
    service.show('Ahoy!', 'success');

    expect(service.open()).toBe(true);
    expect(service.message()).toEqual({
      tone: 'success',
      title: 'Yosh! All Done',
      text: 'Ahoy!',
      code: undefined,
    });
  });

  it('replaces the previous message rather than stacking', () => {
    service.show('First');
    service.show('Second', 'error', 'ERR_CODE');

    expect(service.message()).toEqual({
      tone: 'error',
      title: 'Arrr! Blocked',
      text: 'Second',
      code: 'ERR_CODE',
    });
  });

  it('auto-closes a non-error message after the timeout', () => {
    vi.useFakeTimers();
    service.show('Land ho!');
    expect(service.open()).toBe(true);

    vi.advanceTimersByTime(9000);

    expect(service.open()).toBe(false);
  });

  it('keeps an error message open until dismissed by hand', () => {
    vi.useFakeTimers();
    service.show('Uh oh', 'error');

    vi.advanceTimersByTime(9000);
    expect(service.open()).toBe(true);

    service.close();
    expect(service.open()).toBe(false);
  });

  it('toggle reopens showing the last message', () => {
    service.show('Ahoy!', 'success');
    service.close();
    expect(service.open()).toBe(false);

    service.toggle();

    expect(service.open()).toBe(true);
    expect(service.message().text).toBe('Ahoy!');
  });

  it('toggle collapses an open bubble', () => {
    service.show('Ahoy!');

    service.toggle();

    expect(service.open()).toBe(false);
  });
});
