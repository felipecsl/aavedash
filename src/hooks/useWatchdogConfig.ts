import { useCallback, useEffect, useRef, useState } from 'react';
import type { WatchdogConfig } from '@aave-monitor/core';

export type WatchdogConfigState = {
  watchdog: WatchdogConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useWatchdogConfig(): WatchdogConfigState {
  const [watchdog, setWatchdog] = useState<WatchdogConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/config');
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!contentType.includes('application/json')) {
        throw new Error('Config API returned non-JSON response');
      }
      const body = (await response.json()) as { watchdog?: WatchdogConfig };
      if (cancelledRef.current) return;
      setWatchdog(body.watchdog ?? null);
      setError(null);
    } catch (err) {
      if (cancelledRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load watchdog config';
      setWatchdog(null);
      setError(message);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void fetchConfig(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch-on-mount
    const onFocus = () => {
      void fetchConfig();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelledRef.current = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchConfig]);

  return { watchdog, loading, error, refetch: fetchConfig };
}
