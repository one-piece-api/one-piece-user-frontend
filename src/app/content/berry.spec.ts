import { formatBerry } from './berry';

describe('formatBerry', () => {
  it('groups the digits as the reader writes them and adds the Berry sign', () => {
    expect(formatBerry(3_000_000_000, 'it')).toBe('3.000.000.000 ฿');
    expect(formatBerry(3_000_000_000, 'en')).toBe('3,000,000,000 ฿');
  });

  it('keeps an amount beyond 32 bits exact', () => {
    expect(formatBerry(5_564_800_000, 'en')).toBe('5,564,800,000 ฿');
  });

  it('writes zero as zero', () => {
    expect(formatBerry(0, 'it')).toBe('0 ฿');
  });
});
