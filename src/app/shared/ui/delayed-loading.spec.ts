import { Injector, runInInjectionContext, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { delayedLoading, LOADING_DELAY_MS, LOADING_MIN_VISIBLE_MS } from './delayed-loading';

describe('delayedLoading', () => {
  const loading = signal(false);
  let shown: Signal<boolean>;

  /** Lets the effect see the latest `loading`, then time pass. */
  function after(ms: number): boolean {
    TestBed.tick();
    vi.advanceTimersByTime(ms);
    return shown();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    loading.set(false);
    shown = runInInjectionContext(TestBed.inject(Injector), () => delayedLoading(loading));
    TestBed.tick();
  });

  afterEach(() => vi.useRealTimers());

  it('shows nothing for a load quicker than the delay', () => {
    loading.set(true);
    expect(after(LOADING_DELAY_MS - 1)).toBe(false);

    loading.set(false);
    expect(after(LOADING_DELAY_MS)).toBe(false);
  });

  it('shows the indicator once the load outlasts the delay', () => {
    loading.set(true);
    expect(after(LOADING_DELAY_MS)).toBe(true);
  });

  it('keeps it up for the minimum time when the load ends right after it appears', () => {
    loading.set(true);
    after(LOADING_DELAY_MS);
    vi.advanceTimersByTime(20);

    loading.set(false);
    expect(after(LOADING_MIN_VISIBLE_MS - 21)).toBe(true);
    expect(after(1)).toBe(false);
  });

  it('takes it down at once when it has already been up for the minimum time', () => {
    loading.set(true);
    after(LOADING_DELAY_MS + LOADING_MIN_VISIBLE_MS);

    loading.set(false);
    expect(after(0)).toBe(false);
  });

  it('keeps it up when another load starts while it is going away', () => {
    loading.set(true);
    after(LOADING_DELAY_MS);
    loading.set(false);
    after(10);

    loading.set(true);
    expect(after(LOADING_MIN_VISIBLE_MS)).toBe(true);
  });
});
