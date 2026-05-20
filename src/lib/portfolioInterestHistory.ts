import type { InterestSnapshot } from '../api/aaveMonitor';

const DAY_MS = 24 * 60 * 60 * 1000;
export const BORROW_INTEREST_MOVING_AVERAGE_WINDOW_MS = 7 * DAY_MS;

type BorrowInterestBucket = {
  timestamp: number;
  deltaUsd: number;
};

export type BorrowInterestMovingAveragePoint = InterestSnapshot & {
  deltaUsdMovingAverage: number;
};

export function combineBorrowInterestHistories(
  histories: InterestSnapshot[][],
): InterestSnapshot[] {
  const buckets = new Map<number, BorrowInterestBucket>();

  for (const snapshots of histories) {
    for (const snapshot of snapshots) {
      if (!Number.isFinite(snapshot.timestamp) || !Number.isFinite(snapshot.deltaUsd)) continue;

      const bucketTimestamp = Math.floor(snapshot.timestamp / DAY_MS) * DAY_MS;
      const bucket = buckets.get(bucketTimestamp) ?? {
        timestamp: bucketTimestamp,
        deltaUsd: 0,
      };

      bucket.timestamp = Math.max(bucket.timestamp, snapshot.timestamp);
      bucket.deltaUsd += Math.abs(snapshot.deltaUsd);
      buckets.set(bucketTimestamp, bucket);
    }
  }

  let cumulativeUsd = 0;
  return Array.from(buckets.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((bucket) => {
      cumulativeUsd += bucket.deltaUsd;
      return {
        timestamp: bucket.timestamp,
        cumulativeUsd,
        deltaUsd: bucket.deltaUsd,
        label: null,
      };
    });
}

export function buildBorrowInterestMovingAveragePoints(
  snapshots: InterestSnapshot[],
  windowMs = BORROW_INTEREST_MOVING_AVERAGE_WINDOW_MS,
): BorrowInterestMovingAveragePoint[] {
  const points = snapshots
    .filter((snapshot) => Number.isFinite(snapshot.timestamp) && Number.isFinite(snapshot.deltaUsd))
    .sort((a, b) => a.timestamp - b.timestamp);

  let windowStart = 0;
  let windowSum = 0;

  return points.map((point, index) => {
    windowSum += point.deltaUsd;

    const cutoff = point.timestamp - windowMs;
    let firstWindowPoint = points[windowStart];
    while (firstWindowPoint && firstWindowPoint.timestamp < cutoff) {
      windowSum -= firstWindowPoint.deltaUsd;
      windowStart += 1;
      firstWindowPoint = points[windowStart];
    }

    return {
      ...point,
      deltaUsdMovingAverage: windowSum / (index - windowStart + 1),
    };
  });
}
