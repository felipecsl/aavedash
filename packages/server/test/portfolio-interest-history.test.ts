import assert from 'node:assert/strict';
import test from 'node:test';
import { combineBorrowInterestHistories } from '../../../src/lib/portfolioInterestHistory.ts';

test('combineBorrowInterestHistories sums daily deltas across loan positions', () => {
  const dayOne = Date.UTC(2026, 0, 1, 18);
  const dayTwo = Date.UTC(2026, 0, 2, 18);

  const samples = combineBorrowInterestHistories([
    [
      { timestamp: dayOne, cumulativeUsd: -10, deltaUsd: -10, label: null },
      { timestamp: dayTwo, cumulativeUsd: -14, deltaUsd: -4, label: null },
    ],
    [
      { timestamp: dayOne + 1_000, cumulativeUsd: -2, deltaUsd: -2, label: null },
      { timestamp: dayTwo + 1_000, cumulativeUsd: -5, deltaUsd: -3, label: null },
    ],
  ]);

  assert.equal(samples.length, 2);
  assert.equal(samples[0]?.deltaUsd, 12);
  assert.equal(samples[0]?.cumulativeUsd, 12);
  assert.equal(samples[1]?.deltaUsd, 7);
  assert.equal(samples[1]?.cumulativeUsd, 19);
});

test('combineBorrowInterestHistories sorts days and ignores invalid rows', () => {
  const dayOne = Date.UTC(2026, 0, 1);
  const dayTwo = Date.UTC(2026, 0, 2);

  const samples = combineBorrowInterestHistories([
    [
      { timestamp: Number.NaN, cumulativeUsd: 0, deltaUsd: 10, label: null },
      { timestamp: dayTwo, cumulativeUsd: -5, deltaUsd: -5, label: null },
      { timestamp: dayOne, cumulativeUsd: -3, deltaUsd: -3, label: null },
    ],
  ]);

  assert.deepEqual(
    samples.map((sample) => sample.timestamp),
    [dayOne, dayTwo],
  );
  assert.deepEqual(
    samples.map((sample) => sample.cumulativeUsd),
    [3, 8],
  );
});
