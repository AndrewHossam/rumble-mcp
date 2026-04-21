import { describe, it, expect } from 'vitest';
import {
  computePerformance,
  computeRemainingReturn,
  buildBuyRange,
  mapAnalysts,
  mapReleaseAuthors,
} from '../tools/_shared.js';

describe('computePerformance', () => {
  it('returns undefined when startPrice is undefined', () => {
    expect(computePerformance(undefined, 10)).toBeUndefined();
  });

  it('returns undefined when currentPrice is undefined', () => {
    expect(computePerformance(10, undefined)).toBeUndefined();
  });

  it('returns undefined when startPrice is zero (avoid division by zero)', () => {
    expect(computePerformance(0, 10)).toBeUndefined();
  });

  it('returns 0 when start and current are equal', () => {
    expect(computePerformance(10, 10)).toBe(0);
  });

  it('returns correct positive performance', () => {
    expect(computePerformance(100, 120)).toBe(20);
  });

  it('returns correct negative performance', () => {
    expect(computePerformance(100, 80)).toBe(-20);
  });

  it('rounds to 2 decimal places', () => {
    expect(computePerformance(3, 4)).toBe(33.33);
  });
});

describe('computeRemainingReturn', () => {
  it('returns undefined when currentPrice is zero', () => {
    expect(computeRemainingReturn(0, 10)).toBeUndefined();
  });

  it('returns undefined when targetPrice is undefined', () => {
    expect(computeRemainingReturn(10, undefined)).toBeUndefined();
  });

  it('returns undefined when targetPrice is null', () => {
    expect(computeRemainingReturn(10, null)).toBeUndefined();
  });

  it('returns correct positive remaining return', () => {
    expect(computeRemainingReturn(100, 150)).toBe(50);
  });

  it('returns correct negative remaining return', () => {
    expect(computeRemainingReturn(100, 80)).toBe(-20);
  });

  it('rounds to 2 decimal places', () => {
    expect(computeRemainingReturn(3, 4)).toBe(33.33);
  });
});

describe('buildBuyRange', () => {
  it('returns undefined when start is undefined', () => {
    expect(buildBuyRange(undefined, 10)).toBeUndefined();
  });

  it('returns undefined when end is undefined', () => {
    expect(buildBuyRange(10, undefined)).toBeUndefined();
  });

  it('returns undefined when start is null', () => {
    expect(buildBuyRange(null, 10)).toBeUndefined();
  });

  it('returns undefined when end is null', () => {
    expect(buildBuyRange(10, null)).toBeUndefined();
  });

  it('returns undefined when both are null', () => {
    expect(buildBuyRange(null, null)).toBeUndefined();
  });

  it('returns a range object when both values are present', () => {
    expect(buildBuyRange(1, 2)).toEqual({ start: 1, end: 2 });
  });

  it('returns a range object when both values are zero', () => {
    expect(buildBuyRange(0, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('mapAnalysts', () => {
  it('returns undefined when experts is undefined', () => {
    expect(mapAnalysts(undefined)).toBeUndefined();
  });

  it('returns an empty array when experts is empty', () => {
    expect(mapAnalysts([])).toEqual([]);
  });

  it('returns the name when no nickname is set', () => {
    expect(mapAnalysts([{ id: 'e1', name: 'x' }])).toEqual(['x']);
  });

  it('prefers nickname over name when nickname is set', () => {
    expect(mapAnalysts([{ id: 'e1', name: 'x', nickname: 'y' }])).toEqual(['y']);
  });

  it('handles a mix of experts with and without nicknames', () => {
    expect(
      mapAnalysts([
        { id: 'e1', name: 'Alice', nickname: 'Ali' },
        { id: 'e2', name: 'Bob' },
      ])
    ).toEqual(['Ali', 'Bob']);
  });
});

describe('mapReleaseAuthors', () => {
  it('returns undefined when authors is undefined', () => {
    expect(mapReleaseAuthors(undefined)).toBeUndefined();
  });

  it('returns undefined when no authors have a nickname', () => {
    expect(mapReleaseAuthors([{ nickname: undefined }, {}])).toBeUndefined();
  });

  it('returns undefined when authors array is empty', () => {
    expect(mapReleaseAuthors([])).toBeUndefined();
  });

  it('returns only named authors when some nicknames are missing', () => {
    expect(
      mapReleaseAuthors([{ nickname: 'Hosny' }, { nickname: undefined }, { nickname: 'Ali' }])
    ).toEqual(['Hosny', 'Ali']);
  });

  it('returns all nicknames when every author has one', () => {
    expect(mapReleaseAuthors([{ nickname: 'Hosny' }, { nickname: 'Ali' }])).toEqual([
      'Hosny',
      'Ali',
    ]);
  });

  it('filters out empty-string nicknames', () => {
    expect(mapReleaseAuthors([{ nickname: '' }, { nickname: 'Hosny' }])).toEqual(['Hosny']);
  });
});
