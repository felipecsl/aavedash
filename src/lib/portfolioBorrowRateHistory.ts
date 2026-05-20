import type { BorrowRateSample } from '../components/ReserveCharts';

const BORROW_RATE_SAMPLE_BUCKET_MS = 15 * 60 * 1000;
export const BORROW_RATE_MOVING_AVERAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type BorrowRateHistoryInput = {
  samples: BorrowRateSample[];
  weight: number;
};

type Bucket = {
  weightedBorrowRate: number;
  weightedUtilizationRate: number;
  totalWeight: number;
};

export type BorrowRateMovingAveragePoint = {
  timestamp: number;
  borrowRate: number;
  borrowRateMovingAverage: number;
};

export function combineBorrowRateHistories(
  histories: BorrowRateHistoryInput[],
): BorrowRateSample[] {
  const hasPositiveWeights = histories.some((history) => history.weight > 0);
  const buckets = new Map<number, Bucket>();

  for (const history of histories) {
    const weight = hasPositiveWeights ? Math.max(0, history.weight) : 1;
    if (weight <= 0) continue;

    for (const sample of history.samples) {
      const timestamp = new Date(sample.timestamp).getTime();
      if (!Number.isFinite(timestamp)) continue;

      const bucketTimestamp =
        Math.floor(timestamp / BORROW_RATE_SAMPLE_BUCKET_MS) * BORROW_RATE_SAMPLE_BUCKET_MS;
      const bucket = buckets.get(bucketTimestamp) ?? {
        weightedBorrowRate: 0,
        weightedUtilizationRate: 0,
        totalWeight: 0,
      };

      bucket.weightedBorrowRate += sample.variableBorrowRate * weight;
      bucket.weightedUtilizationRate += sample.utilizationRate * weight;
      bucket.totalWeight += weight;
      buckets.set(bucketTimestamp, bucket);
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, bucket]) => ({
      timestamp: new Date(timestamp).toISOString(),
      variableBorrowRate: bucket.weightedBorrowRate / bucket.totalWeight,
      utilizationRate: bucket.weightedUtilizationRate / bucket.totalWeight,
    }));
}

export function buildBorrowRateMovingAveragePoints(
  samples: BorrowRateSample[],
  windowMs = BORROW_RATE_MOVING_AVERAGE_WINDOW_MS,
): BorrowRateMovingAveragePoint[] {
  const points = samples
    .map((sample) => ({
      timestamp: new Date(sample.timestamp).getTime(),
      borrowRate: sample.variableBorrowRate,
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  let windowStart = 0;
  let windowSum = 0;

  return points.map((point, index) => {
    windowSum += point.borrowRate;

    const cutoff = point.timestamp - windowMs;
    let firstWindowPoint = points[windowStart];
    while (firstWindowPoint && firstWindowPoint.timestamp < cutoff) {
      windowSum -= firstWindowPoint.borrowRate;
      windowStart += 1;
      firstWindowPoint = points[windowStart];
    }

    return {
      ...point,
      borrowRateMovingAverage: windowSum / (index - windowStart + 1),
    };
  });
}
