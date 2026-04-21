import type { ExpertInfo } from '../types/index.js';

/**
 * Compute performance percentage: ((current - start) / start) * 100
 * Returns undefined when either price is missing/zero.
 */
export function computePerformance(
  startPrice: number | undefined,
  currentPrice: number | undefined
): number | undefined {
  if (!currentPrice || !startPrice) return undefined;
  return parseFloat((((currentPrice - startPrice) / startPrice) * 100).toFixed(2));
}

/**
 * Compute remaining return to target: ((target - current) / current) * 100
 * Returns undefined when either price is missing/zero.
 */
export function computeRemainingReturn(
  currentPrice: number | undefined,
  targetPrice: number | null | undefined
): number | undefined {
  if (!currentPrice || !targetPrice) return undefined;
  return parseFloat((((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2));
}

/**
 * Map an experts array to display names (nickname preferred, then full name).
 */
export function mapAnalysts(experts: ExpertInfo[] | undefined): (string | undefined)[] | undefined {
  return experts?.map(e => e.nickname ?? e.name);
}

/**
 * Map a release authors array to nicknames, filtering out entries with no nickname.
 * Returns undefined when the input is undefined or no authors have a nickname.
 */
export function mapReleaseAuthors(
  authors: Array<{ nickname?: string }> | undefined
): string[] | undefined {
  if (!authors) return undefined;
  const named = authors
    .map(a => a.nickname)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
  return named.length > 0 ? named : undefined;
}

/**
 * Build a buy-range object from start/end values.
 * Returns undefined when either bound is null or undefined.
 */
export function buildBuyRange(
  start: number | null | undefined,
  end: number | null | undefined
): { start: number; end: number } | undefined {
  if (start === null || start === undefined || end === null || end === undefined) return undefined;
  return { start, end };
}
