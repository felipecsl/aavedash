import type { InterestSnapshot } from '../api/aaveMonitor';

const DAY_MS = 24 * 60 * 60 * 1000;

type BorrowInterestBucket = {
  timestamp: number;
  deltaUsd: number;
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
