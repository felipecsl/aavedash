import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBorrowRateMovingAveragePoints,
  combineBorrowRateHistories,
} from '../../../src/lib/portfolioBorrowRateHistory.ts';

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

test('buildBorrowRateMovingAveragePoints computes a trailing time-window average', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const samples = buildBorrowRateMovingAveragePoints(
    [
      {
        timestamp: new Date(0).toISOString(),
        variableBorrowRate: 0.03,
        utilizationRate: 0.7,
      },
      {
        timestamp: new Date(dayMs).toISOString(),
        variableBorrowRate: 0.06,
        utilizationRate: 0.8,
      },
      {
        timestamp: new Date(3 * dayMs).toISOString(),
        variableBorrowRate: 0.12,
        utilizationRate: 0.9,
      },
    ],
    2 * dayMs,
  );

  assert.equal(samples.length, 3);
  assert.equal(samples[0]?.borrowRateMovingAverage, 0.03);
  assert.equal(samples[1]?.borrowRateMovingAverage, 0.045);
  assert.equal(samples[2]?.borrowRateMovingAverage, 0.09);
});

test('buildBorrowRateMovingAveragePoints sorts samples and skips invalid timestamps', () => {
  const samples = buildBorrowRateMovingAveragePoints(
    [
      {
        timestamp: new Date(2_000).toISOString(),
        variableBorrowRate: 0.09,
        utilizationRate: 0.9,
      },
      {
        timestamp: 'not-a-date',
        variableBorrowRate: 0.12,
        utilizationRate: 0.95,
      },
      {
        timestamp: new Date(1_000).toISOString(),
        variableBorrowRate: 0.03,
        utilizationRate: 0.7,
      },
    ],
    10_000,
  );

  assert.equal(samples.length, 2);
  assert.equal(samples[0]?.timestamp, 1_000);
  assert.equal(samples[1]?.timestamp, 2_000);
  assert.equal(samples[1]?.borrowRateMovingAverage, 0.06);
});
