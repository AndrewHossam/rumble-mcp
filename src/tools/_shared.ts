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
