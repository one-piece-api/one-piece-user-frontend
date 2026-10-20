/** The sign written after an amount in Berry, the currency of One Piece. */
const BERRY_SIGN = '฿';

/**
 * An amount in Berry as the reader writes numbers - `3.000.000.000 ฿` in Italian,
 * `3,000,000,000 ฿` in English. Exact beyond 32 bits (Roger's 5,564,800,000).
 */
export function formatBerry(amount: number, language: string): string {
  return `${new Intl.NumberFormat(language).format(amount)} ${BERRY_SIGN}`;
}
