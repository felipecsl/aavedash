import assert from 'node:assert/strict';
import test from 'node:test';
import { combineBorrowRateHistories } from '../../../src/lib/portfolioBorrowRateHistory.ts';

test('combineBorrowRateHistories debt-weights samples in the same poll bucket', () => {
  const samples = combineBorrowRateHistories([
    {
      weight: 100,
      samples: [
        {
          timestamp: new Date(1_000).toISOString(),
          variableBorrowRate: 0.04,
          utilizationRate: 0.8,
        },
      ],
    },
    {
      weight: 300,
      samples: [
        {
          timestamp: new Date(2_000).toISOString(),
          variableBorrowRate: 0.08,
          utilizationRate: 0.9,
        },
      ],
    },
  ]);

  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.variableBorrowRate, 0.07);
  assert.equal(samples[0]?.utilizationRate, 0.875);
});

test('combineBorrowRateHistories falls back to equal weights when debt weights are missing', () => {
  const samples = combineBorrowRateHistories([
    {
      weight: 0,
      samples: [
        {
          timestamp: new Date(1_000).toISOString(),
          variableBorrowRate: 0.04,
          utilizationRate: 0.8,
        },
      ],
    },
    {
      weight: 0,
      samples: [
        {
          timestamp: new Date(2_000).toISOString(),
          variableBorrowRate: 0.08,
          utilizationRate: 0.9,
        },
      ],
    },
  ]);

  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.variableBorrowRate, 0.06);
  assert.equal(samples[0]?.utilizationRate, 0.8500000000000001);
});
